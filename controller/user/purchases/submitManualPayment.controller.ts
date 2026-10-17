import type { Response } from "express";
import { prisma } from "@root/prisma.js";
import { PurchaseModel } from "@root/databaseManagers/mongoose/index.js";
import { logger } from "@logger/logger.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";

// ═══════════════════════════════════════════════════════════════════
// SUBMIT MANUAL PAYMENT VERIFICATION REQUEST (User)
// User submits proof of QR/UPI payment for admin verification
// ═══════════════════════════════════════════════════════════════════

interface SubmitManualPaymentBody {
  passType: string;                              // Which pass they're claiming to have paid for
  transactionId: string;                         // UPI transaction ID / bank reference
  paymentMethod: "upi" | "bank_transfer" | "cash" | "other";
  paymentScreenshotS3Key?: string;              // S3 key for uploaded screenshot
  paymentNote?: string;                         // Any additional info
}

export const submitManualPaymentRequest = async (
  req: AuthenticatedUserRequestWithVerifiedEmail & { body: SubmitManualPaymentBody },
  res: Response
) => {
  const userId = req.user?.id;
  
  if (!userId) {
    return res.status(401).json({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  const { passType, transactionId, paymentMethod, paymentScreenshotS3Key, paymentNote } = req.body;

  // transactionId is optional - admin can verify without it
  // if (!transactionId || transactionId.trim().length === 0) {
  //   return res.status(400).json({
  //     statusCode: 400,
  //     message: "Transaction ID is required",
  //   });
  // }

  try {
    // Get user details for snapshot
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        kyId: true,
        college: true,
        isPaidUser: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        statusCode: 404,
        message: "User not found",
      });
    }

    // Check if user already has an active pass
    if (user.isPaidUser) {
      const existingActive = await PurchaseModel.findOne({
        userId,
        status: { $in: ["VERIFIED", "CHECKED_IN"] },
      });

      if (existingActive) {
        return res.status(400).json({
          statusCode: 400,
          message: "You already have an active pass",
        });
      }
    }

    // Check for duplicate transaction ID (only if provided)
    if (transactionId && transactionId.trim().length > 0) {
      const duplicateTxn = await PurchaseModel.findOne({
        "manualVerification.transactionId": transactionId.trim(),
      });

      if (duplicateTxn) {
        return res.status(400).json({
          statusCode: 400,
          message: "This transaction ID has already been submitted",
        });
      }
    }

    // Check for existing pending request from this user
    const existingPending = await PurchaseModel.findOne({
      userId,
      status: "PENDING_VERIFICATION",
    });

    if (existingPending) {
      return res.status(400).json({
        statusCode: 400,
        message: "You already have a pending verification request",
        data: { existingRequestId: existingPending._id },
      });
    }

    // Create the purchase request
    const purchase = await PurchaseModel.create({
      userId,
      source: paymentMethod === "upi" ? "manual_qr" : paymentMethod === "cash" ? "manual_cash" : "manual_other",
      passType,
      amountPaid: 0, // Will be set by admin during verification
      status: "PENDING_VERIFICATION",
      manualVerification: {
        transactionId: transactionId?.trim() || null,
        paymentScreenshotS3Key: paymentScreenshotS3Key || null,
        paymentMethod,
        paymentNote: paymentNote?.trim() || null,
      },
      userSnapshot: {
        email: user.email,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        phone: user.phone || null,
        kyId: user.kyId || null,
        college: user.college || null,
      },
    });

    logger.info({
      msg: "Manual payment verification request submitted",
      purchaseId: purchase._id,
      userId,
      passType,
      transactionId: transactionId?.trim() || "not provided",
      paymentMethod,
    });

    res.status(201).json({
      statusCode: 201,
      message: "Payment verification request submitted. You will be notified once verified.",
      data: {
        purchaseId: purchase._id,
        status: purchase.status,
      },
    });
  } catch (error) {
    logger.error({
      msg: "Failed to submit manual payment request",
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      statusCode: 500,
      message: "Failed to submit payment verification request",
    });
  }
};

/**
 * Get user's payment verification request status
 */
export const getMyPaymentRequestStatus = async (
  req: AuthenticatedUserRequestWithVerifiedEmail,
  res: Response
) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  try {
    const purchases = await PurchaseModel.find({ userId })
      .sort({ createdAt: -1 })
      .select({
        _id: 1,
        source: 1,
        passType: 1,
        status: 1,
        benefits: 1,
        createdAt: 1,
        "manualVerification.verifiedAt": 1,
        "manualVerification.rejectedAt": 1,
        "manualVerification.rejectionReason": 1,
      })
      .lean();

    res.status(200).json({
      statusCode: 200,
      message: "Payment requests fetched",
      data: { purchases },
    });
  } catch (error) {
    logger.error({
      msg: "Failed to fetch payment request status",
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      statusCode: 500,
      message: "Failed to fetch payment request status",
    });
  }
};
