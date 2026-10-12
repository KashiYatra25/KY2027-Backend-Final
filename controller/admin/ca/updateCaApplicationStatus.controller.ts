import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";
import type { CaApplicationStatusUpdateSchemaType } from "@schemas/admin/caStatusUpdate.schema.js";
import { referralIdService } from "@root/services/referral/index.js";
import { queueCaApplicationStatusEmail } from "@root/services/queue/index.js";
import { env } from "@lib/env/environment.js";

// ═══════════════════════════════════════════════════════════════════
// UPDATE CA APPLICATION STATUS
//
// PATCH /admin/ca/update-status
//
// This endpoint is for CHANGING status of already-processed applications.
// NOT for processing PENDING applications (use /admin/ca/approve for that).
//
// Valid transitions:
//   ACCEPTED → REJECTED (revokes CA profile, sends rejection email)
//   REJECTED → ACCEPTED (creates CA profile, sends approval email)
//
// Invalid:
//   PENDING → anything (use /approve endpoint)
//   ACCEPTED → ACCEPTED (no change)
//   REJECTED → REJECTED (no change)
// ═══════════════════════════════════════════════════════════════════

export const updateCaApplicationStatus = catchAsync(
  async (
    req: VerifiedRequest<
      { body: CaApplicationStatusUpdateSchemaType },
      AdminRequestWithVerifiedCreds
    >,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { applicationId, newStatus, reason } = req.validatedData;
    const adminId = req.admin.adminId;

    // ─────────────────────────────────────────────────────────────────
    // 1. Find the application
    // ─────────────────────────────────────────────────────────────────
    const application = await prisma.caApplication.findUnique({
      where: { id: applicationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        caProfile: true,
      },
    });

    if (!application) {
      return next(
        new NotFound().handleResponse(res, {
          info: "Application not found",
        }),
      );
    }

    const currentStatus = application.status;

    // ─────────────────────────────────────────────────────────────────
    // 2. Validate: Cannot use this endpoint for PENDING applications
    // ─────────────────────────────────────────────────────────────────
    if (currentStatus === "PENDING") {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Cannot use this endpoint for pending applications. Use POST /admin/ca/approve instead.",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // 3. Validate: Status must be different (no-op transitions not allowed)
    // ─────────────────────────────────────────────────────────────────
    if (currentStatus === newStatus) {
      return next(
        new BadRequest().handleResponse(res, {
          info: `Application is already ${currentStatus.toLowerCase()}. No change needed.`,
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // At this point, we have valid transitions:
    //   ACCEPTED → REJECTED
    //   REJECTED → ACCEPTED
    // ─────────────────────────────────────────────────────────────────

    const userName = application.user.firstName
      ? `${application.user.firstName} ${application.user.lastName || ""}`.trim()
      : "Applicant";

    // ─────────────────────────────────────────────────────────────────
    // CASE: ACCEPTED → REJECTED
    // Need to: Delete CaProfile, update status, send rejection email
    // ─────────────────────────────────────────────────────────────────
    if (currentStatus === "ACCEPTED" && newStatus === "REJECTED") {
      const revokedReferralId = application.caProfile?.referralId;

      await prisma.$transaction(async (tx) => {
        // Delete the CA profile (this revokes their referral ID)
        if (application.caProfile) {
          await tx.caProfile.delete({
            where: { id: application.caProfile.id },
          });
        }

        // Update application status
        await tx.caApplication.update({
          where: { id: applicationId },
          data: {
            status: "REJECTED",
            rejectionReason: reason,
          },
        });
      });

      // Queue rejection email
      await queueCaApplicationStatusEmail({
        userName,
        email: application.user.email,
        status: "REJECTED",
        rejectionReason: reason || "Status changed by admin",
        dashboardUrl: `${env.CLIENT_ORIGIN}/ca`,
        websiteUrl: env.CLIENT_ORIGIN,
      });

      logger.info("CA application status changed: ACCEPTED → REJECTED", {
        applicationId,
        userId: application.userId,
        revokedReferralId,
        adminId,
        reason,
      });

      new OkResponseStrategy().handleResponse(res, {
        info: "Application status changed to rejected",
        applicationId,
        previousStatus: "ACCEPTED",
        newStatus: "REJECTED",
        revokedReferralId,
      });
      return;
    }

    // ─────────────────────────────────────────────────────────────────
    // CASE: REJECTED → ACCEPTED
    // Need to: Create CaProfile with new referral ID, update status, send approval email
    // ─────────────────────────────────────────────────────────────────
    if (currentStatus === "REJECTED" && newStatus === "ACCEPTED") {
      // Generate a new referral ID
      const referralId = await referralIdService.getNextId();

      const result = await prisma.$transaction(async (tx) => {
        // Check if user was referred by someone - if so, clear that referral
        // (same logic as initial approval)
        const user = await tx.user.findUnique({
          where: { id: application.userId },
          select: { referredByCaId: true },
        });

        if (user?.referredByCaId) {
          // Decrement the referrer's count
          await tx.caProfile.update({
            where: { id: user.referredByCaId },
            data: { numberOfReferrals: { decrement: 1 } },
          });

          // Clear the user's referral info
          await tx.user.update({
            where: { id: application.userId },
            data: {
              referredByCaId: null,
              referredAt: null,
            },
          });

          logger.info("Cleared referral for new CA (status update)", {
            userId: application.userId,
            previousReferrerId: user.referredByCaId,
          });
        }

        // Update application status (clear rejection reason)
        await tx.caApplication.update({
          where: { id: applicationId },
          data: {
            status: "ACCEPTED",
            rejectionReason: null,
          },
        });

        // Create CA profile
        const caProfile = await tx.caProfile.create({
          data: {
            userId: application.userId,
            caApplicationId: applicationId,
            referralId,
            numberOfReferrals: 0,
          },
        });

        return { caProfile };
      });

      // Queue approval email
      await queueCaApplicationStatusEmail({
        userName,
        email: application.user.email,
        status: "ACCEPTED",
        referralId: result.caProfile.referralId,
        dashboardUrl: `${env.CLIENT_ORIGIN}/ca/dashboard`,
        websiteUrl: env.CLIENT_ORIGIN,
      });

      logger.info("CA application status changed: REJECTED → ACCEPTED", {
        applicationId,
        userId: application.userId,
        newReferralId: result.caProfile.referralId,
        adminId,
      });

      new OkResponseStrategy().handleResponse(res, {
        info: "Application status changed to accepted",
        applicationId,
        previousStatus: "REJECTED",
        newStatus: "ACCEPTED",
        caProfile: {
          referralId: result.caProfile.referralId,
          numberOfReferrals: result.caProfile.numberOfReferrals,
        },
        user: {
          email: application.user.email,
          firstName: application.user.firstName,
          lastName: application.user.lastName,
        },
      });
      return;
    }
  },
);
