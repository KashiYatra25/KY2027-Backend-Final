import type { Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { ForbiddenErrorResponse } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";

/**
 * Middleware to check if current user has paid (isPaidUser = true)
 * Use before routes that require a paid user
 */
export const checkUserHasPaidMiddleware = catchAsync(
  async (
    req: AuthenticatedUserRequestWithVerifiedEmail,
    res: Response,
    next: NextFunction,
  ) => {
    const { id: userId } = req.user;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPaidUser: true },
    });

    if (!user?.isPaidUser) {
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: "You must purchase a pass to access this feature",
        }),
      );
    }

    next();
  },
);
