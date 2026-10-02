import type { NextFunction, Response } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { BadRequest } from "zodex-axon/errors";
import { OkResponseStrategy } from "zodex-axon/responses";
import { S3Manager } from "@services/s3/index.js";
import { extractAadhaarFromImage } from "@services/textract/index.js";
import { prisma } from "@root/prisma.js";
import { AccountProgressModel } from "@lib/mongo/user/accountProgress.model.js";
import { env } from "@lib/env/environment.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@utils/helper/auth.types.helper.js";

// Extend request to include extracted Aadhaar data
interface AadhaarExtractedRequest extends AuthenticatedUserRequestWithVerifiedEmail {
  aadhaarData: {
    name: string;
    aadhaarNumber: string;
    gender: "MALE" | "FEMALE" | "OTHER";
    dateOfBirth: string;
    key: string;
  };
}

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

    // Store s3Key in user record (temporary until verification)
    await prisma.user.update({
      where: { id: userId },
      data: { aadhaarS3Key: s3Key },
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Upload URL generated successfully",
      uploadUrl,
      s3Key,
      expiresAt: expiresAt.toISOString(),
    });
  },
);

const getAdhaarUploadConfirmation = catchAsync(
  async (
    req: VerifiedRequest<
      { body: { s3Key: string } },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    next: NextFunction,
  ) => {
    const { id: userId } = req.user;
    const { s3Key } = req.validatedData;

    // Verify that the provided s3Key matches the one stored for the user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aadhaarS3Key: true },
    });

    if (!user || user.aadhaarS3Key !== s3Key) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Invalid S3 key. Please upload the Aadhaar image first.",
        }),
      );
    }

    const progress = await AccountProgressModel.findOne({ userId });
    if (progress) {
      progress.profileCompletionAndVerification!.hasAadhaarBeenUploaded = true;
      await progress.save();
    }

    new OkResponseStrategy().handleResponse(res, {
      info: "Aadhaar image upload confirmed successfully",
    });
  },
);

/**
 * Middleware: Extract Aadhaar data from S3 uploaded image
 * Extracts data using Textract and attaches to request
 * Passes control to confirmAadhaar on success
 */
const extractAadhaarData = catchAsync(
  async (
    req: AuthenticatedUserRequestWithVerifiedEmail,
    res: Response,
    next: NextFunction,
  ) => {
    const { id: userId } = req.user;

    // Get stored s3Key from user record
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aadhaarS3Key: true },
    });

    if (!user?.aadhaarS3Key) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "No Aadhaar image found. Please upload first.",
        }),
      );
    }

    // Extract Aadhaar data from S3 image using Textract
    const result = await extractAadhaarFromImage({
      type: "s3",
      bucket: env.S3_BUCKET,
      key: user.aadhaarS3Key,
    });

    if (!result.success) {
      // Include partial data if available
      const partialData = result.data ? { ...result.data } : undefined;

      return next(
        new BadRequest().handleResponse(res, {
          info: result.error,
          ...(partialData && { partialData }),
        }),
      );
    }

    // Attach extracted data to request for next middleware
    (req as AadhaarExtractedRequest).aadhaarData = {
      name: result.data.name,
      aadhaarNumber: result.data.aadhaarNumber,
      gender: result.data.gender,
      dateOfBirth: result.data.dateOfBirth,
      key: user.aadhaarS3Key,
    };

    next();
  },
);

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
      console.log("Marking Aadhaar as verified for user:", userId);
      progress.profileCompletionAndVerification!.hasAadhaarBeenVerified = true;
      await progress.save();
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

export {
  getUploadUrl,
  getAdhaarUploadConfirmation,
  extractAadhaarData,
  updateUserInfoBasedOnAdhaarData,
};
