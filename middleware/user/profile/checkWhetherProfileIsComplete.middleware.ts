import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import { catchAsync } from "zodex-axon/core";
import type { Response, NextFunction } from "express";
import { ForbiddenErrorResponse } from "zodex-axon/errors";
import { checkForProfileCompletion } from "@root/controller/helper/index.js";

export const checkWhetherProfileIsCompleteMiddleware = catchAsync(
  async (
    req: AuthenticatedUserRequestWithVerifiedEmail,
    res: Response,
    next: NextFunction,
  ) => {
    const { id: userId } = req.user;
    const isProfileCompleted = await checkForProfileCompletion({
      userId,
    });

    if (isProfileCompleted.isComplete === false) {
      return next(new ForbiddenErrorResponse().handleResponse(res, {
        info: "User profile is not complete",
      }));
    }

    next();
  },
);
