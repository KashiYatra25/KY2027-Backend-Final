import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound, UnauthorizedAccess } from "zodex-axon/errors";
import { logger } from "@logger/logger.js";
import { prisma } from "@root/prisma.js";
import { PurchaseModel, CartModel } from "@lib/mongo/index.js";
import { env } from "@lib/env/environment.js";
import { queuePassesInvoiceEmail, queuePaymentFailedEmail } from "@services/queue/index.js";
import type { PaymentWebhookRequestSchemaType } from "@schemas/payment/webhook.schema.js";

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
    // ═══════════════════════════════════════════════════════════════════
    const authHeader = req.headers.authorization;
    const expectedToken = `Bearer ${env.PAYMENT_SERVICE_TOKEN}`;

    if (authHeader !== expectedToken) {
      logger.warn("Payment webhook received with invalid auth", {
        hasAuth: !!authHeader,
      });
      return next(
        new UnauthorizedAccess().handleResponse(res, {
          info: "Invalid authorization",
        }),
      );
    }

    // Schema transforms snake_case to camelCase
    const { orderId, status, paidAt } = req.validatedData;

    logger.info("Payment webhook received", { orderId, status });

    // ═══════════════════════════════════════════════════════════════════
    // 2. Find the pending purchase
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
    // 3. Handle based on status
    // ═══════════════════════════════════════════════════════════════════
    // Go sends status like "PAID", "FAILED", "EXPIRED" (from Cashfree mapping)
    const normalizedStatus = status.toUpperCase();

    if (normalizedStatus === "PAID") {
      await handleSuccessfulPayment(purchase, paidAt);
    } else {
      // FAILED or EXPIRED
      purchase.status = normalizedStatus as "FAILED" | "EXPIRED";
      await purchase.save();

      logger.info("Payment failed/expired", {
        orderId,
        status: normalizedStatus,
        userId: purchase.userId,
      });

      // Send payment failed email notification
      await handleFailedPayment(purchase, normalizedStatus as "FAILED" | "EXPIRED");
    }

    new OkResponseStrategy().handleResponse(res, {
      info: "Webhook processed successfully",
      orderId,
      status: normalizedStatus,
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

  const { userId, orderId, couponId, discount, items, totalAmount } = purchase;

  // ═══════════════════════════════════════════════════════════════════
  // 1. Update purchase status (MongoDB)
  //    Do this first - marks as processed, prevents duplicate handling on retry
  // ═══════════════════════════════════════════════════════════════════
  purchase.status = "PAID";
  purchase.paidAt = paidAt ? new Date(paidAt) : new Date();
  await purchase.save();

  // ═══════════════════════════════════════════════════════════════════
  // 2. Postgres transaction: Mark user as paid + record coupon usage
  //    These must succeed or fail together
  // ═══════════════════════════════════════════════════════════════════
  const user = await prisma.$transaction(async (tx) => {
    // Mark user as paid and fetch their details for email
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { isPaidUser: true },
      select: { firstName: true, lastName: true, email: true },
    });

    // Record coupon usage if coupon was applied
    if (couponId && discount > 0) {
      await tx.couponUsage.create({
        data: {
          couponId,
          userId,
          discountAmount: Math.round(discount * 100), // Store in paise
          orderId,
        },
      });

      await tx.coupon.update({
        where: { id: couponId },
        data: {
          currentUsageCount: { increment: 1 },
        },
      });

      logger.info("Coupon usage recorded", {
        couponId,
        userId,
        orderId,
        discountAmount: discount,
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
  status: "FAILED" | "EXPIRED",
): Promise<void> {
  if (!purchase) return;

  const { userId, orderId, items, totalAmount } = purchase;

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
