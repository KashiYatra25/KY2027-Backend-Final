import { AccountProgressModel } from "@root/databaseManagers/mongoose/index.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";
import { logger } from "@logger/logger.js";
import type { NextFunction, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { ForbiddenErrorResponse } from "zodex-axon/errors";

const checkAdminAccountStatusMiddleware = catchAsync(
  async (
    req: AdminRequestWithVerifiedCreds,
    res: Response,
    next: NextFunction,
  ) => {
    const { id } = req.admin;

    const accountProgress = await AccountProgressModel.findOne({ userId: id }).select("accountStatus");
    if(!accountProgress || accountProgress.accountStatus == "SUSPENDED") {
        logger.warn("Blocked suspended admin account", { adminId: id, path: (req as any).path });
        return next(new ForbiddenErrorResponse().handleResponse(res, {info : "Your account has been suspended"}));
    }

    next();

  },
);

export { checkAdminAccountStatusMiddleware };
