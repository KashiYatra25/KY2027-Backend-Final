import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest } from "zodex-axon/errors";
import { logger } from "@logger/logger.js";
import { prisma } from "@root/prisma.js";
import { CartModel, PassModel, PurchaseModel } from "@lib/mongo/index.js";
import { getPaymentClient } from "@services/grpc/payment.client.js";
import { randomUUID } from "crypto";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import type { CheckoutCartRequestSchemaType } from "@schemas/user/cart.schema.js";

/**
 * Time window a PENDING purchase (and therefore its coupon reservation) is
 * allowed to live before it is considered abandoned/expired. The reservation
 * stores `reservedUntil = now + PENDING_ORDER_TTL_MS` so a cleanup job can
 * reclaim stale slots even if no FAILED/EXPIRED webhook ever arrives.
 *
 * Keep this aligned with the payment provider's session expiry.
 */
export const PENDING_ORDER_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Internal sentinel used to roll back the reservation transaction and map to
 * a user-facing BadRequest. Thrown only inside the $transaction callback.
 */
class CouponReservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CouponReservationError";
  }
}

/**
 * POST /user/cart/checkout
 * Validate cart, apply coupon (if provided), and create payment order
 */
export const checkoutCart = catchAsync(
  async (
    req: VerifiedRequest<
      { body: CheckoutCartRequestSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    next: NextFunction,
  ) => {
    const { id: userId, email } = req.user;
    const { couponCode } = req.validatedData;

    // ═══════════════════════════════════════════════════════════════════
    // 1. Fetch user's cart
    // ═══════════════════════════════════════════════════════════════════
    const cart = await CartModel.findOne({ userId }).lean();

    if (!cart || cart.items.length === 0) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Your cart is empty",
        }),
      );
    }

    // ═══════════════════════════════════════════════════════════════════
    // 2. Fetch pass details and calculate subtotal
    // ═══════════════════════════════════════════════════════════════════
    const passIds = cart.items.map((item) => item.passId);
    const passes = await PassModel.find({
      _id: { $in: passIds },
      active: true,
    }).lean();

    // Verify all passes in cart are still active
    if (passes.length !== passIds.length) {
      const foundIds = new Set(passes.map((p) => p._id.toString()));
      const missingIds = passIds.filter((id) => !foundIds.has(id));
      return next(
        new BadRequest().handleResponse(res, {
          info: "Some passes in your cart are no longer available",
          invalidPassIds: missingIds,
        }),
      );
    }

    // Build price map and calculate subtotal
    const priceMap = new Map(
      passes.map((p) => [p._id.toString(), { price: p.price, name: p.name }]),
    );

    let subtotalPaise = 0;
    const orderItems: Array<{ passId: string; passName: string; quantity: number; unitPrice: number }> = [];

    for (const item of cart.items) {
      const passInfo = priceMap.get(item.passId);
      if (!passInfo) continue; // Should not happen after validation above

      const itemTotal = passInfo.price * item.quantity * 100; // Convert to paise
      subtotalPaise += itemTotal;

      orderItems.push({
        passId: item.passId,
        passName: passInfo.name,
        quantity: item.quantity,
        unitPrice: passInfo.price,
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // 3. Validate coupon (read-only fast-fail checks) and compute discount
    //
    //    NOTE: The checks below are a best-effort UX fast-fail. The real,
    //    race-safe enforcement of usage limits happens in step 7 via an
    //    atomic conditional UPDATE + reservation inside a transaction. Do
    //    NOT rely on these reads alone to gate usage.
    // ═══════════════════════════════════════════════════════════════════
    let discountPaise = 0;
    let appliedCoupon:
      | { id: string; code: string; discountAmount: number }
      | null = null;

    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: couponCode },
        include: {
          usages: {
            where: { userId },
            select: { id: true },
          },
        },
      });

      // Coupon existence check
      if (!coupon) {
        return next(
          new BadRequest().handleResponse(res, {
            info: "Invalid coupon code",
          }),
        );
      }

      // Status check
      if (coupon.status !== "ACTIVE") {
        return next(
          new BadRequest().handleResponse(res, {
            info: "This coupon is no longer active",
          }),
        );
      }

      // Validity period check
      const now = new Date();
      if (coupon.validFrom > now) {
        return next(
          new BadRequest().handleResponse(res, {
            info: "This coupon is not yet valid",
          }),
        );
      }

      if (coupon.validUntil && coupon.validUntil < now) {
        return next(
          new BadRequest().handleResponse(res, {
            info: "This coupon has expired",
          }),
        );
      }

      // Global usage limit check
      if (coupon.maxUsageCount !== null && coupon.currentUsageCount >= coupon.maxUsageCount) {
        return next(
          new BadRequest().handleResponse(res, {
            info: "This coupon has reached its usage limit",
          }),
        );
      }

      // Per-user usage limit check
      if (coupon.usages.length >= coupon.maxUsagePerUser) {
        return next(
          new BadRequest().handleResponse(res, {
            info: "You have already used this coupon the maximum number of times",
          }),
        );
      }

      // Calculate discount
      if (coupon.type === "PERCENTAGE") {
        discountPaise = Math.floor((subtotalPaise * coupon.value) / 100);
      } else {
        // FIXED amount (stored in INR, convert to paise)
        discountPaise = coupon.value * 100;
      }

      // Ensure discount doesn't exceed subtotal
      discountPaise = Math.min(discountPaise, subtotalPaise);

      appliedCoupon = {
        id: coupon.id,
        code: coupon.code,
        discountAmount: discountPaise / 100, // Convert back to INR for response
      };
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4. Calculate final total
    // ═══════════════════════════════════════════════════════════════════
    const totalPaise = subtotalPaise - discountPaise;

    if (totalPaise <= 0) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Invalid order total",
        }),
      );
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5. Fetch user details for payment
    //    User must exist (authenticated via middleware), use OrThrow for safety
    // ═══════════════════════════════════════════════════════════════════
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
      },
    });

    const buyerName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Kashiyatra User";

    // ═══════════════════════════════════════════════════════════════════
    // 6. Create payment order via gRPC
    // ═══════════════════════════════════════════════════════════════════
    const idempotencyKey = `checkout_${userId}_${Date.now()}_${randomUUID().slice(0, 8)}`;

    const paymentClient = getPaymentClient();

    const paymentResponse = await paymentClient.createPayment({
      orderId: "", // Let Go service generate it
      buyer: {
        id: userId,
        email: user.email ?? email,
        phone: user.phone ?? "",
        name: buyerName,
      },
      totalPaise,
      currency: "INR",
      idempotencyKey,
    });

    // ═══════════════════════════════════════════════════════════════════
    // 7. Atomically reserve the coupon (race-safe) if one was applied
    //
    //    This is the authoritative usage-limit enforcement. We:
    //      a) Conditionally increment currentUsageCount only while the global
    //         cap is not yet reached (UPDATE ... WHERE currentUsageCount <
    //         maxUsageCount). updateMany returns the number of rows affected;
    //         0 means the coupon is exhausted — no slot was taken.
    //      b) Count this user's active (RESERVED + USED) claims INSIDE the
    //         same transaction and enforce maxUsagePerUser.
    //      c) Create a RESERVED CouponUsage row tied to this orderId.
    //
    //    All three happen in one transaction so concurrent checkouts cannot
    //    over-reserve. If any guard fails we throw to roll back, release the
    //    (not yet committed) increment, and surface a BadRequest.
    //
    //    The payment order created in step 6 will simply go unused/expire if
    //    reservation fails here.
    // ═══════════════════════════════════════════════════════════════════
    let couponUsageId: string | null = null;

    if (appliedCoupon) {
      const couponId = appliedCoupon.id;
      const reservedUntil = new Date(Date.now() + PENDING_ORDER_TTL_MS);

      try {
        couponUsageId = await prisma.$transaction(async (tx) => {
          // (a) Atomic conditional increment of the global counter.
          //     Column-vs-column comparison (currentUsageCount < maxUsageCount)
          //     is expressed as raw SQL for guaranteed support. $executeRaw
          //     returns the number of affected rows; 0 means no slot was
          //     available (exhausted) or the coupon is no longer ACTIVE.
          const affected = await tx.$executeRaw`
            UPDATE "Coupon"
            SET "currentUsageCount" = "currentUsageCount" + 1
            WHERE "id" = ${couponId}
              AND "status" = 'ACTIVE'
              AND ("maxUsageCount" IS NULL OR "currentUsageCount" < "maxUsageCount")
          `;

          if (affected === 0) {
            // No slot available (exhausted) or no longer active.
            throw new CouponReservationError(
              "This coupon has reached its usage limit",
            );
          }

          // (b) Per-user limit, enforced within the same transaction.
          //     Count active claims (RESERVED holds a pending slot, USED is
          //     a finalised one). A released reservation is deleted, so it is
          //     naturally excluded.
          const coupon = await tx.coupon.findUniqueOrThrow({
            where: { id: couponId },
            select: { maxUsagePerUser: true },
          });

          const userActiveUsages = await tx.couponUsage.count({
            where: {
              couponId,
              userId,
              status: { in: ["RESERVED", "USED"] },
            },
          });

          if (userActiveUsages >= coupon.maxUsagePerUser) {
            throw new CouponReservationError(
              "You have already used this coupon the maximum number of times",
            );
          }

          // (c) Create the reservation row bound to this order.
          const reservation = await tx.couponUsage.create({
            data: {
              couponId,
              userId,
              orderId: paymentResponse.orderId,
              discountAmount: discountPaise, // stored in paise
              status: "RESERVED",
              reservedUntil,
            },
            select: { id: true },
          });

          return reservation.id;
        });
      } catch (err) {
        if (err instanceof CouponReservationError) {
          return next(
            new BadRequest().handleResponse(res, { info: err.message }),
          );
        }
        throw err;
      }

      logger.info("Coupon reserved at checkout", {
        couponId,
        userId,
        orderId: paymentResponse.orderId,
        couponUsageId,
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // 8. Create pending Purchase record (stores the reservation id)
    // ═══════════════════════════════════════════════════════════════════
    await PurchaseModel.create({
      userId,
      orderId: paymentResponse.orderId,
      paymentSessionId: paymentResponse.paymentSessionId,
      status: "PENDING",
      items: orderItems,
      subtotal: subtotalPaise / 100,
      discount: discountPaise / 100,
      totalAmount: totalPaise / 100,
      couponId: appliedCoupon?.id ?? null,
      couponCode: appliedCoupon?.code ?? null,
      couponUsageId,
      paymentMethod: "WEB_APP",
    });

    logger.info("Payment order created", {
      userId,
      orderId: paymentResponse.orderId,
      totalPaise,
      discountPaise,
      couponCode: appliedCoupon?.code ?? null,
    });

    // ═══════════════════════════════════════════════════════════════════
    // 8. Return payment session for frontend redirect
    // ═══════════════════════════════════════════════════════════════════
    new OkResponseStrategy().handleResponse(res, {
      info: "Checkout initiated successfully",
      orderId: paymentResponse.orderId,
      paymentSessionId: paymentResponse.paymentSessionId,
      summary: {
        items: orderItems,
        subtotal: subtotalPaise / 100,
        discount: discountPaise / 100,
        total: totalPaise / 100,
        currency: "INR",
      },
      coupon: appliedCoupon,
    });
  },
);
