import { prisma } from "@root/prisma";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/auth.types.helper";
import type { NextFunction, Response } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import {
  BadRequest,
  ForbiddenErrorResponse,
  NotFound,
} from "zodex-axon/errors";
import type { AdminSuspendSchemaType } from "@schemas/admin/admin.schema";
import type { AdminSuspendRequestWithTargetUser } from "./types";

/**
 * Middleware to validate the target admin exists and can be suspended
 * Only MASTER_ADMIN can suspend MANAGER/OPERATOR
 */
export const validateTargetAdminForSuspension = catchAsync(
  async (
    req: VerifiedRequest<
      { body: AdminSuspendSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { targetEmail } = req.validatedData;

    // Find target user and their admin record
    const targetUser = await prisma.user.findUnique({
      where: { email: targetEmail },
      select: {
        id: true,
        admin: {
          select: { id: true },
        },
        role: {
          select: { level: true },
        },
      },
    });

    if (!targetUser) {
      return next(
        new NotFound().handleResponse(res, {
          info: "User not found",
        }),
      );
    }

    if (!targetUser.admin) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "User is not an admin",
        }),
      );
    }

    if (!targetUser.role) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "User does not have a role assigned",
        }),
      );
    }

    // Cannot suspend MASTER_ADMIN
    if (targetUser.role.level === "MASTER_ADMIN") {
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: "Cannot suspend Master Admin",
        }),
      );
    }

    // Cannot suspend regular USER
    if (targetUser.role.level === "USER") {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Target user is not an admin",
        }),
      );
    }

    (
      req as VerifiedRequest<
        { body: AdminSuspendSchemaType },
        AdminSuspendRequestWithTargetUser
      >
    ).targetAdmin = {
      targetUserId: targetUser.id,
      targetAdminId: targetUser.admin.id,
      targetRole: targetUser.role.level as "MANAGER" | "OPERATOR",
    };

    next();
  },
);

/**
 * Middleware to validate target user can be reactivated
 * Only MASTER_ADMIN can reactivate admins
 */
export const validateTargetUserForReactivation = catchAsync(
  async (
    req: VerifiedRequest<
      { body: AdminSuspendSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { targetEmail, role: newRole } = req.validatedData;
    const { role: requesterRole } = req.user;

    // Only MASTER_ADMIN can reactivate admins
    if (requesterRole !== "MASTER_ADMIN") {
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: "Only Master Admin can reactivate admins",
        }),
      );
    }

    // Find target user
    const targetUser = await prisma.user.findUnique({
      where: { email: targetEmail },
      select: {
        id: true,
        admin: {
          select: { id: true },
        },
        role: {
          select: { level: true },
        },
      },
    });

    if (!targetUser) {
      return next(
        new NotFound().handleResponse(res, {
          info: "User not found",
        }),
      );
    }

    // Check if already an admin
    if (targetUser.admin) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "User is already an admin",
        }),
      );
    }

    (
      req as VerifiedRequest<
        { body: AdminSuspendSchemaType },
        AdminSuspendRequestWithTargetUser
      >
    ).targetAdmin = {
      targetUserId: targetUser.id,
      targetAdminId: "",
      targetRole: newRole as "MANAGER" | "OPERATOR",
    };

    next();
  },
);
