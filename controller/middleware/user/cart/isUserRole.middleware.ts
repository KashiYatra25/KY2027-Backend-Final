import type { NextFunction, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { ForbiddenErrorResponse } from "zodex-axon/errors";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/auth.types.helper.js";

/**
 * Middleware to ensure only users with USER role can access.
 * Blocks MASTER_ADMIN, MANAGER, OPERATOR roles from cart operations.
 */
export const isUserRoleMiddleware = catchAsync(
  async (
    req: AuthenticatedUserRequestWithVerifiedEmail,
    res: Response,
    next: NextFunction,
  ) => {
    const { role } = req.user;

    if (role !== "USER") {
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: "Admin users cannot access cart. This feature is for regular users only.",
        }),
      );
    }

    next();
  },
);
