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
import type { ChangeAdminRoleRequestSchemaType } from "@schemas/admin/admin.schema.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";
import type { RoleLevel } from "@lib/prisma/index.js";

// ═══════════════════════════════════════════════════════════════════
// CHANGE ADMIN ROLE (PROMOTE / DEMOTE)
//
// Changes an existing admin's role level.
//
// Hierarchy:
// - MASTER_ADMIN can change: MANAGER ↔ OPERATOR
// - MANAGER cannot change anyone's role (only invite OPERATORs)
// - Cannot change MASTER_ADMIN's role
// - Cannot change your own role
//
// Valid transitions:
// - MANAGER → OPERATOR (demote)
// - OPERATOR → MANAGER (promote)
// ═══════════════════════════════════════════════════════════════════

/**
 * Role hierarchy levels for comparison
 */
const ROLE_HIERARCHY: Record<RoleLevel, number> = {
  MASTER_ADMIN: 3,
  MANAGER: 2,
  OPERATOR: 1,
  USER: 0,
};

export const changeAdminRole = catchAsync(
  async (
    req: VerifiedRequest<
      { body: ChangeAdminRoleRequestSchemaType },
      AdminRequestWithVerifiedCreds
    >,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { targetEmail, newRole } = req.validatedData;
    const { adminId: performedById, userId: performedByUserId, role: incumbentRole } = req.admin;

    // ─────────────────────────────────────────────────────────────────
    // Only MASTER_ADMIN can change roles
    // ─────────────────────────────────────────────────────────────────
    if (incumbentRole !== "MASTER_ADMIN") {
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: "Only Master Admins can change admin roles",
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
          info: "User is not an admin. Use the invite endpoint to make them an admin first.",
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
    // Cannot change MASTER_ADMIN's role
    // ─────────────────────────────────────────────────────────────────
    if (currentRole === "MASTER_ADMIN") {
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: "Cannot change a Master Admin's role",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Cannot change your own role
    // ─────────────────────────────────────────────────────────────────
    if (targetUser.id === performedByUserId) {
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: "Cannot change your own role",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Check if role is actually changing
    // ─────────────────────────────────────────────────────────────────
    if (currentRole === newRole) {
      return next(
        new BadRequest().handleResponse(res, {
          info: `User is already a ${newRole}`,
          currentRole,
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Validate new role is MANAGER or OPERATOR (not MASTER_ADMIN or USER)
    // ─────────────────────────────────────────────────────────────────
    if (newRole !== "MANAGER" && newRole !== "OPERATOR") {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Can only change role to MANAGER or OPERATOR",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Determine if this is a promotion or demotion
    // ─────────────────────────────────────────────────────────────────
    const isPromotion = ROLE_HIERARCHY[newRole] > ROLE_HIERARCHY[currentRole];
    const actionType = isPromotion ? "PROMOTED" : "DEMOTED";

    // ─────────────────────────────────────────────────────────────────
    // Update the role
    // ─────────────────────────────────────────────────────────────────
    await prisma.role.update({
      where: { id: targetUser.role!.id },
      data: { level: newRole },
    });

    logger.info("Admin role changed", {
      targetUserId: targetUser.id,
      targetEmail,
      previousRole: currentRole,
      newRole,
      actionType,
      performedBy: performedById,
    });

    new OkResponseStrategy().handleResponse(res, {
      info: `Admin ${actionType.toLowerCase()} successfully`,
      userId: targetUser.id,
      previousRole: currentRole,
      newRole,
      actionType,
      performedBy: performedById,
    });
  },
);
