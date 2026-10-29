import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import { ManualPaymentRequestModel } from "@root/databaseManagers/mongoose/index.js";
import { queueManualPaymentRequestStatusEmail } from "@services/queue/emailQueue.service.js";
import { env } from "@lib/env/environment.js";
import { logger } from "@logger/logger.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";
import type {
  RejectManualPaymentRequestSchemaType,
  ManualPaymentRequestIdParamRequestSchemaType,
} from "@schemas/admin/manualPayment.schema.js";

// ═══════════════════════════════════════════════════════════════════
// REJECT MANUAL PAYMENT REQUEST
// 
// MASTER_ADMIN rejects a pending manual payment request.
// Sends email notification to the requestor.
// ═══════════════════════════════════════════════════════════════════

// Pass type display names
const PASS_TYPE_NAMES: Record<string, string> = {
  YATRI: "Yatri Pass",
  DARBAR: "Darbar Pass",
  SWARNIM: "Swarnim Pass",
  ZONAL_SINGLE: "Zonal Single Event Pass",
  ZONAL_MULTI: "Zonal Multi Event Pass",
};

/**
 * POST /admin/manual-payment/requests/:requestId/reject
 * Reject a manual payment request (MASTER_ADMIN only)
 * 
 * Body:
 * - reason: string (rejection reason, required)
 */
export const rejectManualPaymentRequest = catchAsync(
  async (
    req: VerifiedRequest<
      { body: RejectManualPaymentRequestSchemaType; params: ManualPaymentRequestIdParamRequestSchemaType },
      AdminRequestWithVerifiedCreds
    >,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { requestId } = req.validatedParams;
    const { reason } = req.validatedData;
    const adminEmail = req.admin.email;

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

    // Get requestor's info to send email notification
    try {
      const requestorAdmin = await prisma.admin.findUnique({
        where: { id: request.requestedBy },
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
      });

      if (requestorAdmin?.user) {
        const { firstName, lastName, email } = requestorAdmin.user;
        const requestorName = firstName 
          ? `${firstName} ${lastName ?? ""}`.trim()
          : email.split("@")[0] ?? "User";

        await queueManualPaymentRequestStatusEmail({
          requestorName,
          requestorEmail: requestorAdmin.user.email,
          requestId,
          status: "REJECTED",
          passType: PASS_TYPE_NAMES[request.passType] || request.passType,
          numberOfUsers: request.users.length,
          totalAmount: request.amount,
          processedBy: adminEmail,
          rejectionReason: reason.trim(),
          dashboardUrl: env.CLIENT_ADMIN_PANEL_ORIGIN + "/manual-payments",
        });
      }
    } catch (emailError) {
      // Don't fail the request if email queuing fails
      logger.error({
        msg: "Failed to queue rejection email",
        requestId,
        error: emailError instanceof Error ? emailError.message : "Unknown error",
      });
    }

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
