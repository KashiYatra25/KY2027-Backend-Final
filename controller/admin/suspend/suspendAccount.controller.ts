import { prisma } from "@root/prisma.js";
import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import {
  BadRequest,
  ForbiddenErrorResponse,
  NotFound,
} from "zodex-axon/errors";
import { OkResponseStrategy } from "zodex-axon/responses";
import { logger } from "@logger/logger.js";
import {
  AccountProgressModel,
  AccountSuspensionModel,
} from "@root/databaseManagers/mongoose/index.js";
import type { AdminSuspendRequestSchemaType } from "@schemas/admin/admin.schema.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/functions/index.js";
import type { RoleLevel } from "@lib/prisma/index.js";

// ═══════════════════════════════════════════════════════════════════
// SUSPEND USER OR ADMIN ACCOUNT
//
// Hierarchy:
// - MASTER_ADMIN can suspend: MANAGER, OPERATOR, USER
// - MANAGER can suspend: OPERATOR, USER
// - OPERATOR cannot suspend anyone (blocked by role checker middleware)
//
// Prerequisites (handled by middleware):
// - adminRoutesRESTProtectMiddleware: Valid admin JWT
// - roleChecker: Only MASTER_ADMIN and MANAGER can access
// ═══════════════════════════════════════════════════════════════════

/**
 * Roles that each admin level can suspend
 */
const SUSPENSION_AUTHORITY: Record<string, RoleLevel[]> = {
  MASTER_ADMIN: ["MANAGER", "OPERATOR", "USER"],
  MANAGER: ["OPERATOR", "USER"],
};

export const suspendAccount = catchAsync(
  async (
    req: VerifiedRequest<
      { body: AdminSuspendRequestSchemaType },
      AdminRequestWithVerifiedCreds
    >,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { targetEmail, reason } = req.validatedData;
    const { id: suspendedById, role: incumbentRole } = req.admin;

    // ─────────────────────────────────────────────────────────────────
    // Find target user
    // ─────────────────────────────────────────────────────────────────
    const targetUser = await prisma.user.findUnique({
      where: { email: targetEmail },
      select: {
        id: true,
        isSuspended: true,
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

    if (targetUser.isSuspended) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "User is already suspended",
        }),
      );
    }

    const targetRole = targetUser.role?.level ?? "USER";

    // ─────────────────────────────────────────────────────────────────
    // Check suspension authority based on hierarchy
    // ─────────────────────────────────────────────────────────────────
    const allowedToSuspend = SUSPENSION_AUTHORITY[incumbentRole] ?? [];

    if (!allowedToSuspend.includes(targetRole)) {
      logger.warn("Unauthorized suspension attempt", {
        incumbentRole,
        targetRole,
        targetEmail,
        suspendedById,
      });
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: `${incumbentRole} cannot suspend ${targetRole}`,
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Perform suspension - just mark as suspended, preserve all data
    // ─────────────────────────────────────────────────────────────────
    await Promise.all([
      // Mark user as suspended in Prisma
      prisma.user.update({
        where: { id: targetUser.id },
        data: { isSuspended: true },
      }),

      // MongoDB operations
      Promise.all([
        AccountProgressModel.findOneAndUpdate(
          { userId: targetUser.id },
          { accountStatus: "SUSPENDED" },
          { returnDocument: "after" },
        ),
        AccountSuspensionModel.create({
          userId: targetUser.id,
          suspendedBy: suspendedById,
          reason: reason || "No reason provided",
          suspendedOn: new Date(),
        }),
      ]),
    ]);

    logger.info("Account suspended", {
      targetUserId: targetUser.id,
      targetEmail,
      targetRole,
      suspendedBy: suspendedById,
      incumbentRole,
      reason: reason ?? "No reason provided",
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Account suspended successfully",
      suspendedUserId: targetUser.id,
      role: targetRole,
      suspendedBy: suspendedById,
      suspendedOn: new Date().toISOString(),
    });
  },
);
