import { prisma } from "@root/prisma.js";
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

    const user = await prisma.user.findUnique({
      where: { id },
      select: { isSuspended: true },
    });

    if (!user || user.isSuspended) {
      logger.warn("Blocked suspended account", { userId: id, path: req.path });
      return next(new ForbiddenErrorResponse().handleResponse(res, { info: "Your account has been suspended" }));
    }

    next();
  },
);

export { checkUserAccountStatusMiddleware };
