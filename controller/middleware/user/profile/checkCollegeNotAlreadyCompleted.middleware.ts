import type { NextFunction, Response } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { BadRequest, ForbiddenErrorResponse } from "zodex-axon/errors";
import { logger } from "@logger/index.js";
import { AccountProgressModel } from "@lib/mongo/user/accountProgress.model.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/auth.types.helper.js";
import type { ProfileUpdationSchemaType } from "../../schemas/user/profile.schema";

/**
 * Middleware to check if college details have already been submitted.
 * Returns Forbidden error if college is in request body and already completed.
 */
export const checkProfileUpdationAlreadyDoneOrNot = catchAsync(
  async (
    req: VerifiedRequest<
      { body: ProfileUpdationSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { college, phoneNumber } = req.validatedData;
    const { id: userId } = req.user;

    // Check if at least one field is provided
    if (!phoneNumber && !college) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Required atleast phone number or college",
        }),
      );
    }

    const progress = await AccountProgressModel.findOne({ userId }).lean();

    if (
      college &&
      progress?.profileCompletionAndVerification?.hasSelectedCollegeDetails
    ) {
      logger.warn("Duplicate college submission blocked", { userId });
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: "College details have already been submitted and cannot be changed.",
        }),
      );
    } else if (
      phoneNumber &&
      progress?.profileCompletionAndVerification?.hasVerifiedPhoneNumber
    ) {
      logger.warn("Duplicate phone submission blocked", { userId });
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: "College details have already been submitted and cannot be changed.",
        }),
      );
    }

    next();
  },
);
