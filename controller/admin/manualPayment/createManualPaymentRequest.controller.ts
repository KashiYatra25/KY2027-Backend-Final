import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest } from "zodex-axon/errors";
import { ManualPaymentRequestModel } from "@root/databaseManagers/mongoose/index.js";
import { logger } from "@logger/logger.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";
import crypto from "crypto";

// ═══════════════════════════════════════════════════════════════════
// CREATE MANUAL PAYMENT REQUEST
// 
// Admin creates a bulk payment request for users who paid offline.
// Request goes to PENDING status, MASTER_ADMIN must approve.
// ═══════════════════════════════════════════════════════════════════

interface ManualPaymentUser {
  userId: string;
  kyId: string;
  email: string;
}

interface CreateManualPaymentBody {
  users: ManualPaymentUser[];
  passType: "DARBAR" | "YATRI" | "SWARNIM" | "ZONAL_SINGLE" | "ZONAL_MULTI";
  collegeSlug?: string;
  paymentMethod: "UPI" | "NETBANKING" | "WALLET" | "CASH";
  amount: number;
  bonafides?: string[]; // R2 keys
}

/**
 * POST /admin/manual-payment/request
 * Create a manual payment request for bulk user passes
 * 
 * Body:
 * - users: Array<{ userId, kyId, email }>
 * - passType: "DARBAR" | "YATRI" | "SWARNIM" | "ZONAL_SINGLE" | "ZONAL_MULTI"
 * - collegeSlug?: string (required for zonal passes)
 * - paymentMethod: "UPI" | "NETBANKING" | "WALLET" | "CASH"
 * - amount: number
 * - bonafides?: string[] (R2 keys for uploaded files)
 */
export const createManualPaymentRequest = catchAsync(
  async (
    req: VerifiedRequest<{ body: CreateManualPaymentBody }, AdminRequestWithVerifiedCreds>,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { users, passType, collegeSlug, paymentMethod, amount, bonafides } = req.validatedData;
    const adminId = req.admin.adminId;
    const adminEmail = req.admin.email;

    // Validate users array
    if (!users || users.length === 0) {
      new BadRequest().handleResponse(res, {
        info: "At least one user is required",
      });
      return;
    }

    // Validate zonal passes require collegeSlug
    const isZonal = passType === "ZONAL_SINGLE" || passType === "ZONAL_MULTI";
    if (isZonal && !collegeSlug) {
      new BadRequest().handleResponse(res, {
        info: "College slug is required for zonal passes",
      });
      return;
    }

    // Generate unique request ID
    const requestId = `MPR-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    // Create the request
    const request = await ManualPaymentRequestModel.create({
      requestId,
      requestedBy: adminEmail,
      users,
      numberOfPasses: users.length,
      passType,
      collegeSlug: isZonal ? collegeSlug : null,
      paymentMethod,
      amount,
      bonafides: bonafides || [],
      status: "PENDING",
    });

    logger.info({
      msg: "Manual payment request created",
      requestId,
      requestedBy: adminEmail,
      numberOfPasses: users.length,
      passType,
      amount,
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Manual payment request created successfully",
      request: {
        requestId: request.requestId,
        status: request.status,
        numberOfPasses: request.numberOfPasses,
        passType: request.passType,
        amount: request.amount,
        createdAt: request.createdAt,
      },
    });
  },
);
