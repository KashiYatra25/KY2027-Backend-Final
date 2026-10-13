import type { Response, NextFunction } from "express";
import crypto from "node:crypto";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound, UnauthorizedAccess, BadRequest, ForbiddenErrorResponse } from "zodex-axon/errors";
import { logger } from "@logger/logger.js";
import { prisma } from "@root/prisma.js";
import { PurchaseModel, CartModel } from "@lib/mongo/index.js";
import { env } from "@lib/env/environment.js";
import { queuePassesInvoiceEmail, queuePaymentFailedEmail } from "@services/queue/index.js";
import { verifyWebhookSignature } from "@services/payment/webhookSignature.js";
import type {
  PaymentWebhookRequestSchemaType,
  PaymentWebhookStatus,
} from "@schemas/payment/webhook.schema.js";

/**
 * Constant-time comparison of two strings.
 *
 * A plain `===` / `!==` on secret material short-circuits on the first
 * differing byte, leaking timing information an attacker can use to recover
 * the secret byte-by-byte. crypto.timingSafeEqual compares in constant time.
 * We hash both inputs to equal-length SHA-256 digests first so timingSafeEqual
 * never throws on a length mismatch (digest length reveals nothing secret).
 */
function safeCompare(a: string, b: string): boolean {
  const digestA = crypto.createHash("sha256").update(a, "utf8").digest();
  const digestB = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

/**
 * POST /payment/webhook
 * Handle payment status updates from Go payment service
 * 
 * Auth: Authorization: Bearer <PAYMENT_SERVICE_TOKEN>
 * Go sends snake_case (NotifyNodeArgs), schema transforms to camelCase
 * 
 * On successful payment:
 * 1. Update Purchase status to PAID
 * 2. Mark user as isPaidUser
 * 3. Record CouponUsage (if coupon was applied)
 * 4. Clear user's cart
 * 5. Queue confirmation email
 */
export const handlePaymentWebhook = catchAsync(
  async (
    req: VerifiedRequest<{ body: PaymentWebhookRequestSchemaType }>,
    res: Response,
    next: NextFunction,
  ) => {
    // ═══════════════════════════════════════════════════════════════════
    // 1. Verify Bearer token (same token used for gRPC auth)
    //    Constant-time comparison to avoid leaking the token via timing.
    // ═══════════════════════════════════════════════════════════════════
    const authHeader = req.headers.authorization;
    const expectedToken = `Bearer ${env.PAYMENT_SERVICE_TOKEN}`;

    if (typeof authHeader !== "string" || !safeCompare(authHeader, expectedToken)) {
      logger.warn("[security] Payment webhook rejected: invalid auth token", {
        hasAuth: !!authHeader,
        ip: req.ip,
      });
      return next(
        new UnauthorizedAccess().handleResponse(res, {
          info: "Invalid authorization",
        }),
      );
    }

    // ═══════════════════════════════════════════════════════════════════
    // 2. Verify HMAC signature + timestamp (anti-tamper + anti-replay)
    //    The Go service signs `${timestamp}.${rawBody}` with the shared
    //    secret and sends x-webhook-signature / x-webhook-timestamp headers.
    // ═══════════════════════════════════════════════════════════════════
    const signatureHeader = req.headers["x-webhook-signature"];
    const timestampHeader = req.headers["x-webhook-timestamp"];

    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    const timestamp = Array.isArray(timestampHeader) ? timestampHeader[0] : timestampHeader;

    const verification = verifyWebhookSignature(signature, timestamp, req.rawBody);

    if (!verification.ok) {
      const unauthorizedReasons: readonly string[] = [
        "missing_signature",
        "missing_timestamp",
      ];
      const isUnauthorized = unauthorizedReasons.includes(verification.reason);

      logger.warn("[security] Payment webhook rejected: signature verification failed", {
        reason: verification.reason,
        ip: req.ip,
        hasSignature: !!signature,
        hasTimestamp: !!timestamp,
      });

      // Missing headers → 401 (payload was never authenticated).
      // Mismatch / stale / malformed timestamp → 403 (actively invalid,
      // likely tampering or a replay attempt).
      if (isUnauthorized) {
        return next(
          new UnauthorizedAccess().handleResponse(res, {
            info: "Missing webhook signature",
          }),
        );
      }
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: "Invalid webhook signature",
        }),
      );
    }

    // Schema transforms snake_case to camelCase and enum-validates status
    const { orderId, status, amountPaise, paidAt } = req.validatedData;

    logger.info("Payment webhook received", { orderId, status });

    // ═══════════════════════════════════════════════════════════════════
    // 3. Find the pending purchase
    // ═══════════════════════════════════════════════════════════════════
    const purchase = await PurchaseModel.findOne({ orderId });

    if (!purchase) {
      logger.error("Payment webhook: Purchase not found", { orderId });
      return next(
        new NotFound().handleResponse(res, {
          info: "Purchase not found",
        }),
      );
    }

    // Idempotency: if already processed, return success
    if (purchase.status !== "PENDING") {
      logger.info("Payment webhook: Purchase already processed", {
        orderId,
        currentStatus: purchase.status,
        receivedStatus: status,
      });
      new OkResponseStrategy().handleResponse(res, {
        info: "Webhook already processed",
        orderId,
        status: purchase.status,
      });
      return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4. Validate the paid amount matches the order total (only for PAID).
    //    purchase.totalAmount is stored in rupees; the gateway reports
    //    amountPaise in paise. This blocks an attacker (or bug) from marking
    //    an order paid for a smaller/mismatched amount than was actually owed.
    // ═══════════════════════════════════════════════════════════════════
    if (status === "PAID") {
      const expectedPaise = Math.round(purchase.totalAmount * 100);
      if (amountPaise !== expectedPaise) {
        logger.error("[security] Payment webhook amount mismatch", {
          orderId,
          expectedPaise,
          receivedPaise: amountPaise,
          userId: purchase.userId,
          ip: req.ip,
        });
        return next(
          new BadRequest().handleResponse(res, {
            info: "Paid amount does not match order total",
            orderId,
          }),
        );
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5. Handle based on status (enum-validated: PAID | FAILED | EXPIRED)
    // ═══════════════════════════════════════════════════════════════════
    if (status === "PAID") {
      await handleSuccessfulPayment(purchase, paidAt);
    } else {
      // FAILED or EXPIRED
      purchase.status = status;
      await purchase.save();

      logger.info("Payment failed/expired", {
        orderId,
        status,
        userId: purchase.userId,
      });

      // Send payment failed email notification
      await handleFailedPayment(purchase, status);
    }

    new OkResponseStrategy().handleResponse(res, {
      info: "Webhook processed successfully",
      orderId,
      status,
    });
  },
);

/**
 * Handle successful payment:
 * - Update purchase status (MongoDB)
 * - Mark user as paid + record coupon usage (Postgres - transactional)
 * - Clear cart (MongoDB)
 * - Queue confirmation email
 * 
 * Note: Cross-database (Postgres + MongoDB) transactions aren't possible.
 * We order operations so webhook retry can recover from partial failures:
 * 1. Update Purchase first (makes it non-PENDING, prevents duplicate processing)
 * 2. Postgres transaction (user + coupon - atomic)
 * 3. Clear cart last (least critical, can be manually cleared)
 * 4. Queue email (non-critical, can be triggered manually if failed)
 */
async function handleSuccessfulPayment(
  purchase: Awaited<ReturnType<typeof PurchaseModel.findOne>>,
  paidAt?: string,
): Promise<void> {
  if (!purchase) return;

  const { userId, orderId, couponId, couponUsageId, discount, items, totalAmount } = purchase;

  // ═══════════════════════════════════════════════════════════════════
  // 1. Update purchase status (MongoDB)
  //    Do this first - marks as processed, prevents duplicate handling on retry
  // ═══════════════════════════════════════════════════════════════════
  purchase.status = "PAID";
  purchase.paidAt = paidAt ? new Date(paidAt) : new Date();
  await purchase.save();

  // ═══════════════════════════════════════════════════════════════════
  // 2. Postgres transaction: Mark user as paid + finalise coupon reservation
  //    These must succeed or fail together.
  //
  //    IMPORTANT: The coupon slot was already reserved (counter incremented
  //    + RESERVED CouponUsage row created) atomically at checkout time. Here
  //    we only transition the reservation RESERVED -> USED. We must NOT
  //    increment currentUsageCount again, or the slot would be double-counted.
  // ═══════════════════════════════════════════════════════════════════
  const user = await prisma.$transaction(async (tx) => {
    // Mark user as paid and fetch their details for email
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { isPaidUser: true },
      select: { firstName: true, lastName: true, email: true },
    });

    // Finalise the coupon reservation if one exists for this order.
    if (couponId && couponUsageId) {
      // Only transition reservations that are still RESERVED. updateMany is
      // idempotent/safe on webhook retries (a second call affects 0 rows).
      const finalised = await tx.couponUsage.updateMany({
        where: { id: couponUsageId, status: "RESERVED" },
        data: { status: "USED", usedAt: new Date(), reservedUntil: null },
      });

      logger.info("Coupon reservation finalised (USED)", {
        couponId,
        couponUsageId,
        userId,
        orderId,
        transitioned: finalised.count,
      });
    }

    return updatedUser;
  });

  // ═══════════════════════════════════════════════════════════════════
  // 3. Clear user's cart (MongoDB)
  //    Least critical - if this fails, cart just has stale items
  // ═══════════════════════════════════════════════════════════════════
  await CartModel.deleteOne({ userId });

  // ═══════════════════════════════════════════════════════════════════
  // 4. Queue confirmation email
  //    Non-blocking, will retry automatically if fails
  // ═══════════════════════════════════════════════════════════════════
  if (user.email) {
    const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Valued Customer";
    
    try {
      await queuePassesInvoiceEmail({
        userName,
        email: user.email,
        invoiceUrl: `${env.CLIENT_ORIGIN}/purchases`,
        orderDetails: {
          orderId,
          items: items.map((item) => ({
            passName: item.passName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          subtotal: purchase.subtotal,
          discount: discount,
          totalAmount: totalAmount,
          paidAt: (purchase.paidAt ?? new Date()).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          couponCode: purchase.couponCode ?? undefined,
        },
      });

      logger.info("Payment confirmation email queued", { orderId, email: user.email });
    } catch (emailError) {
      // Don't fail the webhook if email queueing fails
      logger.error("Failed to queue payment confirmation email", {
        orderId,
        email: user.email,
        error: emailError instanceof Error ? emailError.message : "Unknown error",
      });
    }
  }

  logger.info("Payment successful - user marked as paid, cart cleared", {
    orderId,
    userId,
    totalAmount: purchase.totalAmount,
    couponId: couponId ?? "none",
  });
}


/**
 * Handle failed/expired payment:
 * - Send notification email to user
 * - Cart is NOT cleared (so user can retry)
 */
async function handleFailedPayment(
  purchase: Awaited<ReturnType<typeof PurchaseModel.findOne>>,
  status: Exclude<PaymentWebhookStatus, "PAID">,
): Promise<void> {
  if (!purchase) return;

  const { userId, orderId, couponId, couponUsageId, items, totalAmount } = purchase;

  // ═══════════════════════════════════════════════════════════════════
  // Release the coupon reservation (if any) so the slot returns to the pool.
  //
  //   - Delete the RESERVED CouponUsage row.
  //   - Decrement currentUsageCount, but ONLY if the row was still RESERVED
  //     (we rely on deletedCount so a webhook retry cannot decrement twice,
  //     and a reservation already finalised as USED is never touched).
  //
  // Both steps run in one transaction so the counter and the row stay
  // consistent. A guard keeps currentUsageCount from going below zero.
  // ═══════════════════════════════════════════════════════════════════
  if (couponId && couponUsageId) {
    try {
      await prisma.$transaction(async (tx) => {
        const deleted = await tx.couponUsage.deleteMany({
          where: { id: couponUsageId, status: "RESERVED" },
        });

        if (deleted.count > 0) {
          await tx.$executeRaw`
            UPDATE "Coupon"
            SET "currentUsageCount" = GREATEST("currentUsageCount" - 1, 0)
            WHERE "id" = ${couponId}
          `;
        }

        logger.info("Coupon reservation released", {
          couponId,
          couponUsageId,
          userId,
          orderId,
          status,
          released: deleted.count,
        });
      });
    } catch (releaseError) {
      // Don't fail the webhook if release fails; the cleanup job will
      // eventually reclaim the stale reservation via reservedUntil.
      logger.error("Failed to release coupon reservation", {
        couponId,
        couponUsageId,
        orderId,
        error:
          releaseError instanceof Error ? releaseError.message : "Unknown error",
      });
    }
  }

  // Get user email from Postgres
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true },
  });

  if (!user?.email) {
    logger.warn("Cannot send payment failed email - no user email", { orderId, userId });
    return;
  }

  const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Valued Customer";

  try {
    await queuePaymentFailedEmail({
      userName,
      email: user.email,
      orderId,
      totalAmount,
      items: items.map((item) => ({
        passName: item.passName,
        quantity: item.quantity,
      })),
      status,
      cartUrl: `${env.CLIENT_ORIGIN}/cart`,
    });

    logger.info("Payment failed email queued", { orderId, email: user.email, status });
  } catch (emailError) {
    // Don't fail the webhook if email queueing fails
    logger.error("Failed to queue payment failed email", {
      orderId,
      email: user.email,
      error: emailError instanceof Error ? emailError.message : "Unknown error",
    });
  }
}
