import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import { PurchaseModel } from "@root/databaseManagers/mongoose/index.js";
import { logger } from "@logger/logger.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import type { SubmitManualPaymentBody } from "@controller/user/helper/types/purchases.types.js";

// ═══════════════════════════════════════════════════════════════════
// SUBMIT MANUAL PAYMENT VERIFICATION REQUEST (User)
// User submits proof of QR/UPI payment for admin verification
// ═══════════════════════════════════════════════════════════════════

export const submitManualPaymentRequest = catchAsync(
  async (
    req: VerifiedRequest<{ body: SubmitManualPaymentBody }, AuthenticatedUserRequestWithVerifiedEmail>,
    res: Response,
    next: NextFunction,
  ) => {
    const { id: userId } = req.user;
    const { passType, transactionId, paymentMethod, paymentScreenshotS3Key, paymentNote } =
      req.validatedData;

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
      return next(new NotFound().handleResponse(res, { info: "User not found" }));
    }

    // Check if user already has an active pass
    if (user.isPaidUser) {
      const existingActive = await PurchaseModel.findOne({
        userId,
        status: { $in: ["VERIFIED", "CHECKED_IN"] },
      });

      if (existingActive) {
        return next(
          new BadRequest().handleResponse(res, { info: "You already have an active pass" }),
        );
      }
    }

    // Check for duplicate transaction ID (only if provided)
    if (transactionId && transactionId.trim().length > 0) {
      const duplicateTxn = await PurchaseModel.findOne({
        "manualVerification.transactionId": transactionId.trim(),
      });

      if (duplicateTxn) {
        return next(
          new BadRequest().handleResponse(res, {
            info: "This transaction ID has already been submitted",
          }),
        );
      }
    }

    // Check for existing pending request from this user
    const existingPending = await PurchaseModel.findOne({
      userId,
      status: "PENDING_VERIFICATION",
    });

    if (existingPending) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "You already have a pending verification request",
          existingRequestId: existingPending._id,
        }),
      );
    }

    // Create the purchase request
    const purchase = await PurchaseModel.create({
      userId,
      source:
        paymentMethod === "upi"
          ? "manual_qr"
          : paymentMethod === "cash"
            ? "manual_cash"
            : "manual_other",
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

    new OkResponseStrategy().handleResponse(res, {
      info: "Payment verification request submitted. You will be notified once verified.",
      purchaseId: purchase._id,
      status: purchase.status,
    });
  },
);
