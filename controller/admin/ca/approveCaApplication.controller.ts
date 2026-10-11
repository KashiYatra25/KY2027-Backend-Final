import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";
import type { CaApplicationApprovalRequestSchemaType } from "@schemas/admin/caApproval.schema.js";
import { referralIdService } from "@root/services/referral/index.js";

/**
 * POST /admin/ca/approve
 * Approve or reject a CA application
 * Only MASTER_ADMIN can access this endpoint
 */
export const approveCaApplication = catchAsync(
  async (
    req: VerifiedRequest<
      { body: CaApplicationApprovalRequestSchemaType },
      AdminRequestWithVerifiedCreds
    >,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { applicationId, action } = req.validatedData;
    const adminUserId = req.admin.id;

    // Find the application
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

    // Check if application is still pending
    if (application.status !== "PENDING") {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Application is not pending",
        }),
      );
    }

    // If rejecting, just update status
    if (action === "REJECTED") {
      const updatedApplication = await prisma.caApplication.update({
        where: { id: applicationId },
        data: { status: "REJECTED" },
        select: {
          id: true,
          status: true,
          updatedAt: true,
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      logger.info("CA application rejected", {
        applicationId,
        userId: application.userId,
        adminUserId,
      });

      new OkResponseStrategy().handleResponse(res, {
        info: "CA application rejected",
        application: updatedApplication,
      });
      return;
    }

    // If approving, create CaProfile with unique referral ID
    const referralId = await referralIdService.getNextId();

    // Use transaction to update application and create profile
    const result = await prisma.$transaction(async (tx) => {
      // Check if this user was referred by someone - if so, remove that referral
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

        logger.info("Cleared referral for new CA", {
          userId: application.userId,
          previousReferrerId: user.referredByCaId,
        });
      }

      // Update application status
      const updatedApplication = await tx.caApplication.update({
        where: { id: applicationId },
        data: { status: "ACCEPTED" },
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

      return { updatedApplication, caProfile };
    });

    logger.info("CA application approved", {
      applicationId,
      userId: application.userId,
      referralId: result.caProfile.referralId,
      adminUserId,
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "CA application approved successfully",
      applicationId: result.updatedApplication.id,
      status: result.updatedApplication.status,
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
  },
);
