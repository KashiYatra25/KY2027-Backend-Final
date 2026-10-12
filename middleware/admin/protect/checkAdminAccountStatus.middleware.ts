import { prisma } from "@root/prisma.js";
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
    const { userId, adminId } = req.admin;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isSuspended: true },
    });

    if (!user || user.isSuspended) {
      logger.warn("Blocked suspended admin account", { userId, adminId, path: (req as any).path });
      return next(new ForbiddenErrorResponse().handleResponse(res, { info: "Your account has been suspended" }));
    }

    next();
  },
);

export { checkAdminAccountStatusMiddleware };
