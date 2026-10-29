import { prisma } from "@root/prisma.js";
import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import {
  BadRequest,
  ForbiddenErrorResponse,
  NotFound,
} from "zodex-axon/errors";
import { logger } from "@logger/logger.js";
import type { DemoteAdminToUserRequestSchemaType } from "@schemas/admin/admin.schema.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// DEMOTE ADMIN TO USER
//
// Completely removes admin privileges from a user:
// - Deletes the Admin record
// - Changes role level from MANAGER/OPERATOR to USER
// - Revokes all admin access
//
// Restrictions:
// - Only MASTER_ADMIN can perform this action
// - Cannot demote MASTER_ADMIN
// - Cannot demote yourself
// ═══════════════════════════════════════════════════════════════════

export const demoteAdminToUser = catchAsync(
  async (
    req: VerifiedRequest<
      { body: DemoteAdminToUserRequestSchemaType },
      AdminRequestWithVerifiedCreds
    >,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { targetEmail } = req.validatedData;
    const { adminId: performedById, userId: performedByUserId, role: incumbentRole } = req.admin;

    // ─────────────────────────────────────────────────────────────────
    // Only MASTER_ADMIN can demote admins to users
    // ─────────────────────────────────────────────────────────────────
    if (incumbentRole !== "MASTER_ADMIN") {
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: "Only Master Admins can demote admins to users",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Find target user with their admin record
    // ─────────────────────────────────────────────────────────────────
    const targetUser = await prisma.user.findUnique({
      where: { email: targetEmail },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        slugName: true,
        isSuspended: true,
        admin: {
          select: { id: true },
        },
        role: {
          select: { id: true, level: true },
        },
      },
    });

    if (!targetUser) {
      return next(
        new NotFound().handleResponse(res, {
          info: "User not found with this email",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Verify target is an admin
    // ─────────────────────────────────────────────────────────────────
    if (!targetUser.admin) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "User is not an admin",
        }),
      );
    }

    const currentRole = targetUser.role?.level;

    if (!currentRole) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Target user has no role assigned",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Cannot demote MASTER_ADMIN
    // ─────────────────────────────────────────────────────────────────
    if (currentRole === "MASTER_ADMIN") {
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: "Cannot demote a Master Admin",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Cannot demote yourself
    // ─────────────────────────────────────────────────────────────────
    if (targetUser.id === performedByUserId) {
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: "Cannot demote yourself",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Perform the demotion in a transaction:
    // 1. Delete the Admin record
    // 2. Update role level to USER
    // ─────────────────────────────────────────────────────────────────
    await prisma.$transaction([
      // Delete admin record
      prisma.admin.delete({
        where: { id: targetUser.admin.id },
      }),
      // Update role to USER
      prisma.role.update({
        where: { id: targetUser.role!.id },
        data: { level: "USER" },
      }),
    ]);

    logger.info("Admin demoted to user", {
      targetUserId: targetUser.id,
      targetEmail,
      previousRole: currentRole,
      newRole: "USER",
      performedBy: performedById,
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Admin demoted to user successfully",
      userId: targetUser.id,
      previousRole: currentRole,
      newRole: "USER",
      performedBy: performedById,
    });
  },
);
