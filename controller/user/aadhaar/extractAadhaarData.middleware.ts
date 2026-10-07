import type { NextFunction, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { BadRequest } from "zodex-axon/errors";
import { extractAadhaarFromImage } from "@services/textract/index.js";
import { logger } from "@logger/index.js";
import { prisma } from "@root/prisma.js";
import { env } from "@lib/env/environment.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@utils/helper/auth.types.helper.js";
import type { AadhaarExtractedRequest } from "./types.js";

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
      logger.warn("Aadhaar extraction attempted with no uploaded image", { userId });
      return next(
        new BadRequest().handleResponse(res, {
          info: "No Aadhaar image found. Please upload first.",
        }),
      );
    }

    logger.debug("Starting Textract extraction", { userId, s3Key: user.aadhaarS3Key });

    // Extract Aadhaar data from S3 image using Textract
    const result = await extractAadhaarFromImage({
      type: "s3",
      bucket: env.S3_BUCKET,
      key: user.aadhaarS3Key,
    });

    if (!result.success) {
      logger.warn("Textract extraction failed", {
        userId,
        s3Key: user.aadhaarS3Key,
        error: result.error,
        partialFields: result.data ? Object.keys(result.data).filter(k => result.data![k as keyof typeof result.data]) : [],
      });
      const partialData = result.data ? { ...result.data } : undefined;

      return next(
        new BadRequest().handleResponse(res, {
          info: result.error,
          ...(partialData && { partialData }),
        }),
      );
    }

    logger.info("Textract extraction succeeded", { userId, s3Key: user.aadhaarS3Key });

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

export { extractAadhaarData };
