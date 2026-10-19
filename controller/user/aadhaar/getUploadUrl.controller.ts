import type { NextFunction, Response } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { BadRequest } from "zodex-axon/errors";
import { OkResponseStrategy } from "zodex-axon/responses";
import { S3Manager } from "@services/s3/index.js";
import { logger } from "@logger/logger.js";
import { prisma } from "@root/prisma.js";
import { env } from "@lib/env/environment.js";
import { AccountProgressModel } from "@lib/mongo/user/accountProgress.model.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";

/**
 * Step 1: Get pre-signed URL for Aadhaar image upload
 * POST /aadhaar/upload-url
 * Frontend uses this URL to upload directly to S3
 */
const getUploadUrl = catchAsync(
  async (
    req: VerifiedRequest<
      { body: { fileType: string } },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    next: NextFunction,
  ) => {
    const { id: userId } = req.user;
    const { fileType } = req.validatedData;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!fileType || !allowedTypes.includes(fileType)) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Invalid file type. Only JPEG and PNG are allowed.",
        }),
      );
    }

    const s3Manager = new S3Manager(env.AWS_REGION, env.S3_BUCKET);
    const { uploadUrl, s3Key, expiresAt } = await s3Manager.generateUploadUrl({
      userId,
      fileType: fileType as "image/jpeg" | "image/png" | "image/jpg",
      folder: "aadhaar",
    });

    logger.info("Aadhaar S3 upload URL generated", { userId, s3Key, expiresAt });

    // Store s3Key in user record (temporary until verification)
    await prisma.user.update({
      where: { id: userId },
      data: { aadhaarS3Key: s3Key },
    });

    // Commit the identity method to "aadhaar" the moment the upload starts,
    // locking out the manual path (unless already set / already verified).
    // This is defense-in-depth alongside the explicit select-method endpoint.
    try {
      const progress = await AccountProgressModel.findOne({ userId });
      const verification = progress?.profileCompletionAndVerification;
      if (
        progress &&
        verification &&
        !verification.hasIdentityBeenVerified &&
        !verification.identityVerificationMethod
      ) {
        verification.identityVerificationMethod = "aadhaar";
        await progress.save();
        logger.info("Identity method locked to aadhaar on upload start", { userId });
      }
    } catch (err) {
      // Non-fatal: never block the upload-url flow on method-locking.
      logger.warn("Failed to lock identity method on upload start", {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const data = {
      uploadUrl,
      s3Key,
      expiresAt: expiresAt.toISOString(),
    };

    new OkResponseStrategy().handleResponse(res, {
      info: "Upload URL generated successfully",
      ...data,
    });
  },
);

export { getUploadUrl };
