import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { ManualPaymentRequestModel } from "@root/databaseManagers/mongoose/index.js";
import { logger } from "@logger/logger.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// REJECT MANUAL PAYMENT REQUEST
// 
// MASTER_ADMIN rejects a pending manual payment request.
// ═══════════════════════════════════════════════════════════════════

interface RejectRequestBody {
  reason: string;
}

/**
 * POST /admin/manual-payment/requests/:requestId/reject
 * Reject a manual payment request (MASTER_ADMIN only)
 * 
 * Body:
 * - reason: string (rejection reason, required)
 */
export const rejectManualPaymentRequest = catchAsync(
  async (
    req: VerifiedRequest<{ body: RejectRequestBody }, AdminRequestWithVerifiedCreds>,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { requestId } = req.params;
    const { reason } = req.validatedData;
    const adminEmail = req.admin.email;

    if (!reason || reason.trim().length === 0) {
      new BadRequest().handleResponse(res, {
        info: "Rejection reason is required",
      });
      return;
    }

    // Find the request
    const request = await ManualPaymentRequestModel.findOne({ requestId });

    if (!request) {
      new NotFound().handleResponse(res, {
        info: "Manual payment request not found",
      });
      return;
    }

    if (request.status !== "PENDING") {
      new BadRequest().handleResponse(res, {
        info: `Request is already ${request.status.toLowerCase()}`,
      });
      return;
    }

    // Update request status
    await ManualPaymentRequestModel.updateOne(
      { requestId },
      {
        $set: {
          status: "REJECTED",
          processedBy: adminEmail,
          processedAt: new Date(),
          processNote: reason.trim(),
        },
      },
    );

    logger.info({
      msg: "Manual payment request rejected",
      requestId,
      rejectedBy: adminEmail,
      reason: reason.trim(),
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Manual payment request rejected",
      request: {
        requestId,
        status: "REJECTED",
        processedAt: new Date().toISOString(),
        processNote: reason.trim(),
      },
    });
  },
);
