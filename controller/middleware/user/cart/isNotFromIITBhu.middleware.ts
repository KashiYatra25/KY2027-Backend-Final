import type { NextFunction, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { ForbiddenErrorResponse } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/auth.types.helper.js";

/**
 * Middleware to ensure user is NOT from IIT BHU.
 * Cart and pass purchases are only for external users.
 */
export const isNotFromIITBhuMiddleware = catchAsync(
  async (
    req: AuthenticatedUserRequestWithVerifiedEmail,
    res: Response,
    next: NextFunction,
  ) => {
    const { id: userId } = req.user;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isFromIITBhu: true },
    });

    if (user?.isFromIITBhu) {
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: "IIT BHU students cannot purchase passes. Entry is free for you!",
        }),
      );
    }

    next();
  },
);
