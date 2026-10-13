/**
 * Stale Coupon Reservation Cleanup Job
 * ═══════════════════════════════════════════════════════════════════════
 *
 * WHY THIS EXISTS
 * ---------------
 * Coupon slots are reserved atomically at checkout time (currentUsageCount is
 * incremented and a RESERVED CouponUsage row is created). The slot is normally
 * finalised (-> USED) or released (deleted + counter decremented) by the
 * payment webhook (PAID / FAILED / EXPIRED).
 *
 * However a webhook can be lost, delayed, or never sent (e.g. the user simply
 * closes the payment page). Without a safety net those reservations would hold
 * a coupon slot forever, slowly exhausting the coupon. This job reclaims those
 * abandoned slots.
 *
 * WHAT IT DOES
 * ------------
 * For every CouponUsage still in RESERVED state whose `reservedUntil` is in the
 * past, it:
 *   1. Deletes the reservation row (guarded on status = RESERVED so a race with
 *      a late webhook cannot double-process).
 *   2. Decrements the coupon's currentUsageCount (floored at 0).
 *   3. Marks the corresponding PENDING Purchase (MongoDB) as EXPIRED.
 *
 * It is idempotent and safe to run repeatedly / concurrently: each reservation
 * is released at most once because the delete is conditioned on status.
 *
 * HOW TO SCHEDULE IT (job concept)
 * --------------------------------
 * This module intentionally only exposes a plain async function so it can be
 * driven by whatever scheduler the deployment uses. Options:
 *
 *   • BullMQ repeatable job (bullmq is already a dependency):
 *       const queue = new Queue("maintenance", { connection });
 *       await queue.add("release-stale-coupon-reservations", {},
 *         { repeat: { every: 5 * 60 * 1000 } }); // every 5 minutes
 *       // worker:
 *       new Worker("maintenance", async () => {
 *         await releaseStaleCouponReservations();
 *       }, { connection });
 *
 *   • node-cron / setInterval in a dedicated worker process:
 *       setInterval(() => void releaseStaleCouponReservations(), 5 * 60_000);
 *
 *   • An external cron hitting an admin-only route that calls this function.
 *
 * Recommended cadence: every 1–5 minutes. The window itself is governed by
 * PENDING_ORDER_TTL_MS (see checkoutCart.controller.ts), so a reservation is
 * only reclaimed once it is genuinely past its TTL.
 */

import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";
import { PurchaseModel } from "@lib/mongo/index.js";

export interface ReleaseStaleReservationsResult {
  scanned: number;
  released: number;
  purchasesExpired: number;
}

/**
 * Release all expired RESERVED coupon reservations and expire their pending
 * purchases. Returns a small summary for logging/metrics.
 *
 * @param now - override "current time" (useful for tests). Defaults to new Date().
 * @param batchSize - max reservations to process per invocation (back-pressure).
 */
export async function releaseStaleCouponReservations(
  now: Date = new Date(),
  batchSize = 500,
): Promise<ReleaseStaleReservationsResult> {
  const stale = await prisma.couponUsage.findMany({
    where: {
      status: "RESERVED",
      reservedUntil: { not: null, lt: now },
    },
    select: { id: true, couponId: true, orderId: true, userId: true },
    take: batchSize,
  });

  let released = 0;
  let purchasesExpired = 0;

  for (const reservation of stale) {
    try {
      // Release the Postgres reservation atomically.
      const didRelease = await prisma.$transaction(async (tx) => {
        const deleted = await tx.couponUsage.deleteMany({
          where: { id: reservation.id, status: "RESERVED" },
        });

        if (deleted.count === 0) {
          // A concurrent webhook/job already handled it.
          return false;
        }

        await tx.$executeRaw`
          UPDATE "Coupon"
          SET "currentUsageCount" = GREATEST("currentUsageCount" - 1, 0)
          WHERE "id" = ${reservation.couponId}
        `;

        return true;
      });

      if (!didRelease) continue;
      released += 1;

      // Expire the matching PENDING purchase in MongoDB (best-effort).
      if (reservation.orderId) {
        const update = await PurchaseModel.updateOne(
          { orderId: reservation.orderId, status: "PENDING" },
          { $set: { status: "EXPIRED" } },
        );
        if (update.modifiedCount > 0) purchasesExpired += 1;
      }
    } catch (err) {
      logger.error("Failed to release stale coupon reservation", {
        reservationId: reservation.id,
        couponId: reservation.couponId,
        orderId: reservation.orderId,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  if (stale.length > 0) {
    logger.info("Stale coupon reservation cleanup completed", {
      scanned: stale.length,
      released,
      purchasesExpired,
    });
  }

  return { scanned: stale.length, released, purchasesExpired };
}
