import type { NextFunction, Response } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { BadRequest } from "zodex-axon/errors";
import { OkResponseStrategy } from "zodex-axon/responses";
import { logger } from "@logger/index.js";
import { prisma } from "@root/prisma.js";
import { AccountProgressModel } from "@lib/mongo/user/accountProgress.model.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@utils/helper/auth.types.helper.js";

const getAadhaarUploadConfirmation = catchAsync(
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
      logger.warn("Aadhaar upload confirmation failed: s3Key mismatch", { userId, providedKey: s3Key });
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
      logger.info("Aadhaar upload confirmed", { userId, s3Key });
    }

    new OkResponseStrategy().handleResponse(res, {
      info: "Aadhaar image upload confirmed successfully",
    });
  },
);

export { getAadhaarUploadConfirmation };
