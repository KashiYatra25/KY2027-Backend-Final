import type { Response } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";
import { AccountProgressModel } from "@lib/mongo/user/accountProgress.model.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import type { ManualIdentityVerificationSchemaType } from "@schemas/user/profile.schema.js";

/**
 * POST /user/profile/manual-identity
 * Submit identity details manually (alternative to Aadhaar verification)
 *
 * Note: Post-save hooks on AccountProgress handle:
 * - Auto-setting isPaidUser for IIT BHU users
 * - Generating kyId on profile completion
 */
const submitManualIdentity = catchAsync(
  async (
    req: VerifiedRequest<
      { body: ManualIdentityVerificationSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
  ) => {
    const { id: userId } = req.user;
    const { firstName, dateOfBirth, gender } = req.validatedData;

    // Parse DOB
    const dob = new Date(dateOfBirth);

    // Update user with manual details
    await prisma.user.update({
      where: { id: userId },
      data: {
        firstName,
        gender,
        dob,
        // No Aadhaar number for manual verification
        aadhaarNumber: null,
        aadhaarS3Key: null,
      },
    });

    // Update MongoDB - mark identity as verified via manual method
    const progress = await AccountProgressModel.findOne({ userId });
    if (progress) {
      progress.profileCompletionAndVerification!.hasIdentityBeenVerified = true;
      progress.profileCompletionAndVerification!.identityVerificationMethod = "manual";
      await progress.save();
      logger.info("Manual identity verification completed", { userId, firstName, gender });
    }

    new OkResponseStrategy().handleResponse(res, {
      info: "Identity details saved successfully.",
      firstName,
      gender,
      dateOfBirth,
    });
  },
);

export { submitManualIdentity };
