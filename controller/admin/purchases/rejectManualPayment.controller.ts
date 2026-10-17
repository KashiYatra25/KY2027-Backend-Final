import type { Response } from "express";
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

export const rejectManualPayment = async (
  req: AdminRequestWithVerifiedCreds & { body: RejectPaymentBody },
  res: Response
) => {
  const { purchaseId, rejectionReason } = req.body;
  const adminId = req.admin?.adminId;

  if (!adminId) {
    return res.status(401).json({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  if (!rejectionReason || rejectionReason.trim().length === 0) {
    return res.status(400).json({
      statusCode: 400,
      message: "Rejection reason is required",
    });
  }

  try {
    const purchase = await PurchaseModel.findById(purchaseId);

    if (!purchase) {
      return res.status(404).json({
        statusCode: 404,
        message: "Purchase not found",
      });
    }

    if (purchase.status !== "PENDING_VERIFICATION") {
      return res.status(400).json({
        statusCode: 400,
        message: `Cannot reject purchase with status: ${purchase.status}`,
      });
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

    // TODO: Optionally send rejection email to user

    logger.info({
      msg: "Manual payment rejected",
      purchaseId,
      userId: purchase.userId,
      rejectedBy: adminId,
      rejectionReason,
    });

    res.status(200).json({
      statusCode: 200,
      message: "Payment rejected",
      data: { purchase },
    });
  } catch (error) {
    logger.error({
      msg: "Failed to reject payment",
      purchaseId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      statusCode: 500,
      message: "Failed to reject payment",
    });
  }
};
