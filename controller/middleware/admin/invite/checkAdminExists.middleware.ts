import { prisma } from "@root/prisma";
import type { NextFunction, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { BadRequest } from "zodex-axon/errors";
import type { AdminInviteRequestWithTargetUser } from "./types";

/**
 * Middleware to check if target user is already an admin
 */
export const checkAdminDoesNotExist = catchAsync(
  async (
    req: AdminInviteRequestWithTargetUser,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { targetUserId } = req.targetAdminUser;

    const doesAdminExist = await prisma.admin.findUnique({
      where: { userId: targetUserId },
    });

    if (doesAdminExist) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Admin already exists for this user",
        }),
      );
    }

    next();
  },
);
