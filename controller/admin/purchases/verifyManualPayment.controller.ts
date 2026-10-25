import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import { PurchaseModel } from "@root/databaseManagers/mongoose/index.js";
import { queuePassesInvoiceEmail } from "@services/queue/emailQueue.service.js";
import { logger } from "@logger/logger.js";
import { invalidateProfileCache } from "@root/services/redis/entityCache.service.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";
import type { VerifyPaymentBody } from "@controller/admin/helper/types/purchases.types.js";

// ═══════════════════════════════════════════════════════════════════
// VERIFY MANUAL PAYMENT (Admin)
// Admin verifies a pending manual payment and sets custom benefits
// ═══════════════════════════════════════════════════════════════════

export const verifyManualPayment = catchAsync(
  async (
    req: VerifiedRequest<{ body: VerifyPaymentBody }, AdminRequestWithVerifiedCreds>,
    res: Response,
    next: NextFunction,
  ) => {
    const { purchaseId, passType, amountPaid, benefits, verificationNote } = req.validatedData;
    const adminId = req.admin?.adminId;

    if (!adminId) {
      return next(new BadRequest().handleResponse(res, { info: "Unauthorized" }));
    }

    // Find the purchase
    const purchase = await PurchaseModel.findById(purchaseId);

    if (!purchase) {
      return next(new NotFound().handleResponse(res, { info: "Purchase not found" }));
    }

    if (purchase.status !== "PENDING_VERIFICATION") {
      return next(
        new BadRequest().handleResponse(res, {
          info: `Cannot verify purchase with status: ${purchase.status}`,
        }),
      );
    }

    // Update purchase with verified status and custom benefits
    purchase.status = "VERIFIED";
    purchase.passType = passType;
    purchase.amountPaid = amountPaid;
    purchase.benefits = benefits as typeof purchase.benefits;
    purchase.manualVerification = {
      ...purchase.manualVerification,
      verifiedBy: adminId,
      verifiedAt: new Date(),
      verificationNote: verificationNote || undefined,
    };

    await purchase.save();

    // Mark user as paid (if matched to a user)
    if (purchase.userId && purchase.userId !== "UNMATCHED") {
      await prisma.user.update({
        where: { id: purchase.userId },
        data: { isPaidUser: true },
      });

      await invalidateProfileCache(purchase.userId);

      // Queue confirmation email
      if (purchase.userSnapshot?.email) {
        await queuePassesInvoiceEmail({
          userName: purchase.userSnapshot.name || "User",
          email: purchase.userSnapshot.email,
          invoiceUrl: "",
          orderDetails: {
            passType,
            amountPaid,
            verifiedAt: new Date().toISOString(),
            verifiedBy: adminId,
          },
        });
      }
    }

    logger.info({
      msg: "Manual payment verified",
      purchaseId,
      userId: purchase.userId,
      passType,
      amountPaid,
      verifiedBy: adminId,
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Payment verified successfully",
      purchase,
    });
  },
);
