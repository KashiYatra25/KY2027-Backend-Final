import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import type { ValidateReferralParamsSchemaType } from "@schemas/user/referral.schema.js";

/**
 * GET /ca/validate/:referralId
 * Check if a referral ID is valid (exists and belongs to an active CA)
 * Public endpoint - for frontend validation before submission
 */
export const validateReferralId = catchAsync(
  async (
    req: VerifiedRequest<{ params: ValidateReferralParamsSchemaType }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { referralId } = req.validatedParams;

    const caProfile = await prisma.caProfile.findUnique({
      where: { referralId: referralId.toUpperCase() },
      select: {
        id: true,
        user: {
          select: {
            firstName: true,
            college: true,
          },
        },
      },
    });

    if (!caProfile) {
      return next(
        new NotFound().handleResponse(res, {
          info: "Referral ID not found",
        }),
      );
    }

    new OkResponseStrategy().handleResponse(res, {
      info: "Referral ID is valid",
      ca: {
        name: caProfile.user.firstName ?? "Campus Ambassador",
        college: caProfile.user.college,
      },
    });
  },
);
