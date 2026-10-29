import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import {
  ManualPaymentRequestModel,
  PurchaseModel,
  ZonalUserCollegeModel,
} from "@root/databaseManagers/mongoose/index.js";
import { queueManualPaymentRequestStatusEmail } from "@services/queue/emailQueue.service.js";
import { env } from "@lib/env/environment.js";
import { logger } from "@logger/logger.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";
import type {
  ApproveManualPaymentRequestSchemaType,
  ManualPaymentRequestIdParamRequestSchemaType,
} from "@schemas/admin/manualPayment.schema.js";

// ═══════════════════════════════════════════════════════════════════
// APPROVE MANUAL PAYMENT REQUEST
// 
// MASTER_ADMIN approves a pending manual payment request.
// Creates purchase records for all users in the request.
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
 * POST /admin/manual-payment/requests/:requestId/approve
 * Approve a manual payment request (MASTER_ADMIN only)
 * 
 * Body:
 * - note?: string (optional approval note)
 */
export const approveManualPaymentRequest = catchAsync(
  async (
    req: VerifiedRequest<
      { body: ApproveManualPaymentRequestSchemaType; params: ManualPaymentRequestIdParamRequestSchemaType },
      AdminRequestWithVerifiedCreds
    >,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { requestId } = req.validatedParams;
    const { note } = req.validatedData || {};
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

    const isZonal = request.passType === "ZONAL_SINGLE" || request.passType === "ZONAL_MULTI";

    // Process each user
    const processedUsers: string[] = [];
    const errors: string[] = [];

    for (const user of request.users) {
      try {
        if (isZonal && request.collegeSlug) {
          // Create/update zonal pass
          const eventLimit = request.passType === "ZONAL_MULTI" ? -1 : 1;
          
          await ZonalUserCollegeModel.findOneAndUpdate(
            { userId: user.userId, collegeSlug: request.collegeSlug },
            {
              $push: {
                passes: {
                  passType: request.passType === "ZONAL_MULTI" ? "MULTI_EVENT" : "SINGLE_EVENT",
                  amount: request.amount / request.users.length,
                  paymentStatus: "completed",
                  paymentSource: "manual",
                  purchasedAt: new Date(),
                },
              },
              $set: {
                eventLimit,
                userSnapshot: {
                  email: user.email,
                  kyId: user.kyId,
                },
              },
            },
            { upsert: true, new: true },
          );
          
          // Also update user's isPaidUser status for zonal passes
          await prisma.user.update({
            where: { id: user.userId },
            data: { isPaidUser: true },
          });
        } else {
          // Create main festival purchase
          await PurchaseModel.create({
            userId: user.userId,
            source: "manual_other",
            passType: request.passType,
            amountPaid: request.amount / request.users.length,
            status: "VERIFIED",
            manualVerification: {
              paymentMethod: request.paymentMethod.toLowerCase() as "upi" | "bank_transfer" | "cash" | "other",
              verifiedBy: adminEmail,
              verifiedAt: new Date(),
            },
            userSnapshot: {
              email: user.email,
              kyId: user.kyId,
            },
          });

          // Update user's isPaidUser status
          await prisma.user.update({
            where: { id: user.userId },
            data: { isPaidUser: true },
          });
        }

        processedUsers.push(user.kyId);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`${user.kyId}: ${errorMsg}`);
        logger.error({
          msg: "Error processing user in manual payment approval",
          userId: user.userId,
          kyId: user.kyId,
          error: errorMsg,
        });
      }
    }

    // Update request status
    await ManualPaymentRequestModel.updateOne(
      { requestId },
      {
        $set: {
          status: "APPROVED",
          processedBy: adminEmail,
          processedAt: new Date(),
          processNote: note || null,
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
          status: "APPROVED",
          passType: PASS_TYPE_NAMES[request.passType] || request.passType,
          numberOfUsers: request.users.length,
          totalAmount: request.amount,
          processedBy: adminEmail,
          processNote: note || null,
          dashboardUrl: env.CLIENT_ADMIN_PANEL_ORIGIN + "/manual-payments",
        });
      }
    } catch (emailError) {
      // Don't fail the request if email queuing fails
      logger.error({
        msg: "Failed to queue approval email",
        requestId,
        error: emailError instanceof Error ? emailError.message : "Unknown error",
      });
    }

    logger.info({
      msg: "Manual payment request approved",
      requestId,
      approvedBy: adminEmail,
      processedUsers: processedUsers.length,
      errors: errors.length,
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Manual payment request approved",
      request: {
        requestId,
        status: "APPROVED",
        processedAt: new Date().toISOString(),
        processNote: note || null,
      },
      summary: {
        totalUsers: request.users.length,
        processed: processedUsers.length,
        errors: errors.length,
        errorDetails: errors.length > 0 ? errors : undefined,
      },
    });
  },
);
