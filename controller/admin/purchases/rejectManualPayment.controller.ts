import type { Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { PurchaseModel } from "@root/databaseManagers/mongoose/index.js";
import { logger } from "@logger/logger.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// REJECT MANUAL PAYMENT (Admin)
// Admin rejects a pending manual payment request
// ═══════════════════════════════════════════════════════════════════

interface RejectPaymentBody {
  purchaseId: string;
  rejectionReason: string;
}

export const rejectManualPayment = catchAsync(
  async (
    req: AdminRequestWithVerifiedCreds & { body: RejectPaymentBody },
    res: Response,
    next: NextFunction,
  ) => {
    const { purchaseId, rejectionReason } = req.body;
    const adminId = req.admin?.adminId;

    if (!adminId) {
      return next(new BadRequest().handleResponse(res, { info: "Unauthorized" }));
    }

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return next(new BadRequest().handleResponse(res, { info: "Rejection reason is required" }));
    }

    const purchase = await PurchaseModel.findById(purchaseId);

    if (!purchase) {
      return next(new NotFound().handleResponse(res, { info: "Purchase not found" }));
    }

    if (purchase.status !== "PENDING_VERIFICATION") {
      return next(
        new BadRequest().handleResponse(res, {
          info: `Cannot reject purchase with status: ${purchase.status}`,
        }),
      );
    }

    // Update purchase with rejected status
    purchase.status = "REJECTED";
    purchase.manualVerification = {
      ...purchase.manualVerification,
      rejectedBy: adminId,
      rejectedAt: new Date(),
      rejectionReason: rejectionReason.trim(),
    };

    await purchase.save();

    logger.info({
      msg: "Manual payment rejected",
      purchaseId,
      userId: purchase.userId,
      rejectedBy: adminId,
      rejectionReason,
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Payment rejected",
      purchase,
    });
  },
);
