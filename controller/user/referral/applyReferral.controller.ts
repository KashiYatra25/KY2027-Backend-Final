import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import type { AddReferralIdRequestSchemaType } from "@schemas/user/referral.schema.js";

/**
 * POST /user/apply-referral
 * Apply a CA's referral code to the current user
 *
 * Rules:
 * - User can only apply referral once (cannot change after)
 * - Referral ID must exist (valid CA)
 * - User cannot refer themselves
 * - Increments the CA's referral count
 */
export const applyReferral = catchAsync(
  async (
    req: VerifiedRequest<
      { body: AddReferralIdRequestSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { id: userId } = req.user;
    const { referralId } = req.validatedData;

    // Check if user already has a referral applied
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referredByCaId: true },
    });

    if (user?.referredByCaId) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "You have already applied a referral code",
        }),
      );
    }

    // Find the CA profile with this referral ID
    const caProfile = await prisma.caProfile.findUnique({
      where: { referralId: referralId.toUpperCase() },
      select: {
        id: true,
        userId: true,
        user: {
          select: { firstName: true },
        },
      },
    });

    if (!caProfile) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Invalid referral code",
        }),
      );
    }

    // User cannot refer themselves
    if (caProfile.userId === userId) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "You cannot use your own referral code",
        }),
      );
    }

    // Apply referral and increment CA's count in a transaction
    await prisma.$transaction([
      // Update user with referral info
      prisma.user.update({
        where: { id: userId },
        data: {
          referredByCaId: caProfile.id,
          referredAt: new Date(),
        },
      }),
      // Increment CA's referral count
      prisma.caProfile.update({
        where: { id: caProfile.id },
        data: {
          numberOfReferrals: { increment: 1 },
        },
      }),
    ]);

    logger.info("Referral applied successfully", {
      userId,
      caProfileId: caProfile.id,
      referralId: referralId.toUpperCase(),
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Referral applied successfully",
      referredBy: caProfile.user.firstName ?? "Campus Ambassador",
    });
  },
);
