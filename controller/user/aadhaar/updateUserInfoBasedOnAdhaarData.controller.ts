import type { NextFunction, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { S3Manager } from "@services/s3/index.js";
import { logger } from "@logger/index.js";
import { prisma } from "@root/prisma.js";
import { AccountProgressModel } from "@lib/mongo/user/accountProgress.model.js";
import { env } from "@lib/env/environment.js";
import type { AadhaarExtractedRequest } from "./types.js";
import { autoSetPaidForIITBhuUser } from "@root/controller/helper/checkWhetherProfileIsCompleted.js";

/**
 * Step 2: Confirm Aadhaar - Save verified data and cleanup
 * POST /aadhaar/verify
 * Called after extractAadhaarData middleware
 * Receives extracted data from middleware, saves to DB, deletes S3 image
 */
const updateUserInfoBasedOnAdhaarData = catchAsync(
  async (req: AadhaarExtractedRequest, res: Response, next: NextFunction) => {
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

    // Update MongoDB - mark Aadhaar as verified
    const progress = await AccountProgressModel.findOne({ userId });
    if (progress) {
      progress.profileCompletionAndVerification!.hasAadhaarBeenVerified = true;
      await progress.save();
      logger.info("Aadhaar verified and profile updated", { userId, aadhaarLast4: aadhaarNumber.slice(-4), gender, dob });
    }

    // Auto-set isPaidUser for IIT BHU users if profile is now complete
    const autoSetPaid = await autoSetPaidForIITBhuUser(userId);
    if (autoSetPaid) {
      logger.info("Auto-set isPaidUser for IIT BHU user after profile completion", { userId });
    }

    // Delete image from S3 (no need to store after verification)
    const s3Manager = new S3Manager(env.AWS_REGION, env.S3_BUCKET);
    await s3Manager.deleteObject(key);

    const data = {
      aadhaarLast4: aadhaarNumber.slice(-4),
      name,
      gender,
      dateOfBirth,
    };

    new OkResponseStrategy().handleResponse(res, {
      info: "Aadhaar verified successfully.",
      ...data,
    });
  },
);

export { updateUserInfoBasedOnAdhaarData };
