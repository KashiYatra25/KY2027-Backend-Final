import type { Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { ForbiddenErrorResponse } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";

/**
 * Middleware to check if current user is an approved Campus Ambassador
 * Use on routes that require CA access (e.g., /ca/my-profile, /ca/rank)
 */
export const checkUserIsCaMiddleware = catchAsync(
  async (
    req: AuthenticatedUserRequestWithVerifiedEmail,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { id: userId } = req.user;

    const caProfile = await prisma.caProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!caProfile) {
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: "You are not a Campus Ambassador",
        }),
      );
    }

    return next();
  },
);
