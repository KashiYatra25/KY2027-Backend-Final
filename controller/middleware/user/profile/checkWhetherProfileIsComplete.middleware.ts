import type { AuthenticatedUserRequestWithVerifiedEmail } from "@root/utils/helper/auth.types.helper";
import { catchAsync } from "zodex-axon/core";
import type { Request , Response , NextFunction } from 'express'
import { ForbiddenErrorResponse } from "zodex-axon/errors";
import { checkForProfileCompletion } from "@root/controller/helper/checkWhetherProfileIsCompleted";

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
      new ForbiddenErrorResponse().handleResponse(res, {
        info: "User profile is not complete",
      });
      return;
    }

    next();
  },
);
