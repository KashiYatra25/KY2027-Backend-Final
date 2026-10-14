import type { Response, NextFunction } from "express";
import crypto from "node:crypto";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound, UnauthorizedAccess, BadRequest } from "zodex-axon/errors";
import { logger } from "@logger/logger.js";
import { prisma } from "@root/prisma.js";
import { PurchaseModel, CartModel } from "@lib/mongo/index.js";
import { env } from "@lib/env/environment.js";
import { queuePassesInvoiceEmail, queuePaymentFailedEmail } from "@services/queue/index.js";
import type {
  PaymentWebhookRequestSchemaType,
  PaymentWebhookStatus,
} from "@schemas/payment/webhook.schema.js";

/**
 * Constant-time comparison of two strings.
 * Prevents timing attacks when comparing secret tokens.
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
 * Security: NCL (Network-level Controls) provides additional protection
 * 
 * On successful payment:
 * 1. Update Purchase status to PAID
 * 2. Mark user as isPaidUser
 * 3. Finalise CouponUsage (if coupon was applied)
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
    //    Additional security provided by NCL (Network-level Controls).
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

    // Schema transforms snake_case to camelCase and enum-validates status
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
    // 3. Handle based on status (enum-validated: PAID | FAILED | EXPIRED)
    //    Amount validation is done in Go service when receiving from Cashfree
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
 * - Mark user as paid + finalise coupon usage (Postgres - transactional)
 * - Clear cart (MongoDB)
 * - Queue confirmation email
 */
async function handleSuccessfulPayment(
  purchase: Awaited<ReturnType<typeof PurchaseModel.findOne>>,
  paidAt?: string,
): Promise<void> {
  if (!purchase) return;

  const { userId, orderId, couponId, couponUsageId, discount, items, totalAmount } = purchase;

  // ═══════════════════════════════════════════════════════════════════
  // 1. Update purchase status (MongoDB)
  // ═══════════════════════════════════════════════════════════════════
  purchase.status = "PAID";
  purchase.paidAt = paidAt ? new Date(paidAt) : new Date();
  await purchase.save();

  // ═══════════════════════════════════════════════════════════════════
  // 2. Postgres transaction: Mark user as paid + finalise coupon reservation
  // ═══════════════════════════════════════════════════════════════════
  const user = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { isPaidUser: true },
      select: { firstName: true, lastName: true, email: true },
    });

    // Finalise the coupon reservation if one exists
    if (couponId && couponUsageId) {
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
  // ═══════════════════════════════════════════════════════════════════
  await CartModel.deleteOne({ userId });

  // ═══════════════════════════════════════════════════════════════════
  // 4. Queue confirmation email
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
 * - Release coupon reservation
 * - Send notification email to user
 */
async function handleFailedPayment(
  purchase: Awaited<ReturnType<typeof PurchaseModel.findOne>>,
  status: Exclude<PaymentWebhookStatus, "PAID">,
): Promise<void> {
  if (!purchase) return;

  const { userId, orderId, couponId, couponUsageId, items, totalAmount } = purchase;

  // Release the coupon reservation if any
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
      logger.error("Failed to release coupon reservation", {
        couponId,
        couponUsageId,
        orderId,
        error: releaseError instanceof Error ? releaseError.message : "Unknown error",
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
    logger.error("Failed to queue payment failed email", {
      orderId,
      email: user.email,
      error: emailError instanceof Error ? emailError.message : "Unknown error",
    });
  }
}
