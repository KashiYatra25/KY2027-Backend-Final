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
    // 3. Validate and apply coupon (if provided)
    // ═══════════════════════════════════════════════════════════════════
    let discountPaise = 0;
    let appliedCoupon: { id: string; code: string; discountAmount: number } | null = null;

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
    // 7. Create pending Purchase record
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
