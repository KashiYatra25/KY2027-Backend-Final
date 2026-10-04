import { prisma } from "@root/prisma";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/auth.types.helper";
import type { NextFunction, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { BadRequest } from "zodex-axon/errors";
import type { AdminAuthRequestWithAdminData } from "./types";

/**
 * Middleware to check if the requesting user is an admin
 */
export const validateUserIsAdmin = catchAsync(
  async (
    req: AuthenticatedUserRequestWithVerifiedEmail,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { id } = req.user;

    const admin = await prisma.admin.findUnique({
      where: { userId: id },
      select: { id: true, password: true },
    });

    if (!admin) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Admin not found",
        }),
      );
    }

    (req as AdminAuthRequestWithAdminData).adminData = {
      adminId: admin.id,
      hashedPassword: admin.password,
    };

    next();
  },
);
