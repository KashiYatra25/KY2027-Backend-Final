import { AccountProgressModel } from "@root/databaseManagers/mongoose";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import { logger } from "@logger/logger.js";
import type { NextFunction, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { ForbiddenErrorResponse } from "zodex-axon/errors";

const checkUserAccountStatusMiddleware = catchAsync(
  async (
    req: AuthenticatedUserRequestWithVerifiedEmail,
    res: Response,
    next: NextFunction,
  ) => {
    const { id } = req.user;

    const accountProgress = await AccountProgressModel.findOne({ userId: id }).select("accountStatus");
    if(!accountProgress || accountProgress.accountStatus == "SUSPENDED") {
        logger.warn("Blocked suspended account", { userId: id, path: (req as any).path });
        return next(new ForbiddenErrorResponse().handleResponse(res, {info : "Your account has been suspended"}));
    }

    next();

  },
);

export { checkUserAccountStatusMiddleware };
