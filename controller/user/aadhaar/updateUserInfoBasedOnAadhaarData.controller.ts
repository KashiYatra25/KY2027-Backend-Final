import type { Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { S3Manager } from "@services/s3/index.js";
import { logger } from "@logger/logger.js";
import { prisma } from "@root/prisma.js";
import { AccountProgressModel } from "@lib/mongo/user/accountProgress.model.js";
import { env } from "@lib/env/environment.js";
import type { AadhaarExtractedRequest } from "./helper/types/aadhaar.types.js";

/**
 * Step 2: Confirm Aadhaar - Save verified data and cleanup
 * POST /aadhaar/verify
 * Called after extractAadhaarDataMiddleware middleware
 * Receives extracted data from middleware, saves to DB, deletes S3 image
 *
 * Note: Post-save hooks on AccountProgress handle:
 * - Auto-setting isPaidUser for IIT BHU users
 * - Generating kyId on profile completion
 */
const updateUserInfoBasedOnAadhaarData = catchAsync(
  async (req: AadhaarExtractedRequest, res: Response) => {
    const { id: userId } = req.user;
    const { name, aadhaarNumber, gender, dateOfBirth, key } = req.aadhaarData;

    // Parse DOB (format: DD/MM/YYYY or DD-MM-YYYY)
    let dob: Date | null = null;
    if (dateOfBirth) {
      const [day, month, year] = dateOfBirth.split(/[\/\-]/);
      if (day && month && year) {
        dob = new Date(`${year}-${month}-${day}`);
      }
    }

    // Update user with verified data
    await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: name,
        gender: gender,
        dob: dob,
        aadhaarNumber: aadhaarNumber,
        aadhaarS3Key: null, // Clear temporary S3 key after verification
      },
    });

    // Update MongoDB - mark identity as verified via Aadhaar (post-save hooks will handle the rest)
    const progress = await AccountProgressModel.findOne({ userId });
    if (progress) {
      progress.profileCompletionAndVerification!.hasIdentityBeenVerified = true;
      progress.profileCompletionAndVerification!.identityVerificationMethod = "aadhaar";
      await progress.save();
      logger.info("Aadhaar verified and profile updated", { userId, aadhaarLast4: aadhaarNumber.slice(-4), gender, dob });
    }

    // Delete image from S3 (no need to store after verification)
    const s3Manager = new S3Manager(env.AWS_REGION, env.S3_BUCKET);
    await s3Manager.deleteObject(key);

    new OkResponseStrategy().handleResponse(res, {
      info: "Aadhaar verified successfully.",
      aadhaarLast4: aadhaarNumber.slice(-4),
      name,
      gender,
      dateOfBirth,
    });
  },
);

export { updateUserInfoBasedOnAadhaarData };
