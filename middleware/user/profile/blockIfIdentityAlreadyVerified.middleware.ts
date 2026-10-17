import type { NextFunction, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { ForbiddenErrorResponse } from "zodex-axon/errors";
import { logger } from "@logger/logger.js";
import { AccountProgressModel } from "@lib/mongo/user/accountProgress.model.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";

/**
 * Middleware to check if identity has already been verified.
 * Returns Forbidden error if identity is already verified.
 */
export const blockIfIdentityAlreadyVerifiedMiddleware = catchAsync(
  async (
    req: AuthenticatedUserRequestWithVerifiedEmail,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { id: userId } = req.user;

    const progress = await AccountProgressModel.findOne({ userId }).lean();

    if (progress?.profileCompletionAndVerification?.hasIdentityBeenVerified) {
      logger.warn("Duplicate identity verification blocked", { userId });
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: "Identity has already been verified and cannot be changed.",
        }),
      );
    }

    next();
  },
);
