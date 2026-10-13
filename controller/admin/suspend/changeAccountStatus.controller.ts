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
import type { AdminAccountStatusChangeRequestSchemaType } from "@schemas/admin/admin.schema.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/functions/index.js";
import type { RoleLevel } from "@lib/prisma/index.js";
import { queueAccountStatusChangeEmail } from "@services/queue/index.js";

// ═══════════════════════════════════════════════════════════════════
// CHANGE ACCOUNT STATUS (SUSPEND / REACTIVATE)
//
// Hierarchy:
// - MASTER_ADMIN can change status of: MANAGER, OPERATOR, USER
// - MANAGER can change status of: OPERATOR, USER
// - OPERATOR cannot change anyone's status (blocked by role checker middleware)
//
// Prerequisites (handled by middleware):
// - adminRoutesRESTProtectMiddleware: Valid admin JWT
// - roleChecker: Only MASTER_ADMIN and MANAGER can access
// ═══════════════════════════════════════════════════════════════════

/**
 * Roles that each admin level can manage
 */
const STATUS_CHANGE_AUTHORITY: Record<string, RoleLevel[]> = {
  MASTER_ADMIN: ["MANAGER", "OPERATOR", "USER"],
  MANAGER: ["OPERATOR", "USER"],
};

export const changeAccountStatus = catchAsync(
  async (
    req: VerifiedRequest<
      { body: AdminAccountStatusChangeRequestSchemaType },
      AdminRequestWithVerifiedCreds
    >,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { targetEmail, action, reason } = req.validatedData;
    const { adminId: performedById, userId: performedByUserId, role: incumbentRole } = req.admin;

    // ─────────────────────────────────────────────────────────────────
    // Find target user
    // ─────────────────────────────────────────────────────────────────
    const targetUser = await prisma.user.findUnique({
      where: { email: targetEmail },
      select: {
        id: true,
        email: true,
        firstName: true,
        slugName: true,
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

    // ─────────────────────────────────────────────────────────────────
    // Validate action is valid for current state
    // ─────────────────────────────────────────────────────────────────
    if (action === "SUSPEND" && targetUser.isSuspended) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "User is already suspended",
        }),
      );
    }

    if (action === "REACTIVATE" && !targetUser.isSuspended) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "User is not suspended",
        }),
      );
    }

    const targetRole = targetUser.role?.level ?? "USER";

    // ─────────────────────────────────────────────────────────────────
    // Check authority based on hierarchy
    // ─────────────────────────────────────────────────────────────────
    const allowedToManage = STATUS_CHANGE_AUTHORITY[incumbentRole] ?? [];

    if (!allowedToManage.includes(targetRole)) {
      logger.warn("Unauthorized account status change attempt", {
        incumbentRole,
        targetRole,
        targetEmail,
        action,
        performedById,
      });
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: `${incumbentRole} cannot ${action.toLowerCase()} ${targetRole}`,
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Get the admin who is performing the action
    // ─────────────────────────────────────────────────────────────────
    const performingAdmin = await prisma.user.findUnique({
      where: { id: performedByUserId },
      select: { firstName: true, slugName: true },
    });

    // ─────────────────────────────────────────────────────────────────
    // Perform status change and create audit record
    // ─────────────────────────────────────────────────────────────────
    const newSuspendedState = action === "SUSPEND";
    const actionReason = reason || (action === "SUSPEND" ? "No reason provided" : "Account reactivated");

    const auditRecord = await prisma.$transaction(async (tx) => {
      // Update user's suspended status
      await tx.user.update({
        where: { id: targetUser.id },
        data: { isSuspended: newSuspendedState },
      });

      // Create audit record
      // Note: Using existing schema fields (suspendedBy, suspendedOn)
      // The reason field stores both the action and the reason for audit purposes
      return tx.accountSuspension.create({
        data: {
          userId: targetUser.id,
          suspendedBy: performedById,
          reason: `[${action}] ${actionReason}`,
        },
      });
    });

    // ─────────────────────────────────────────────────────────────────
    // Send email notification
    // ─────────────────────────────────────────────────────────────────
    await queueAccountStatusChangeEmail({
      userName: targetUser.firstName || targetUser.slugName || "User",
      email: targetUser.email,
      action: action === "SUSPEND" ? "SUSPENDED" : "REACTIVATED",
      reason: actionReason,
      suspendedByName: performingAdmin?.firstName || performingAdmin?.slugName || "Admin",
      suspendedByRole: incumbentRole,
    });

    logger.info("Account status changed", {
      targetUserId: targetUser.id,
      targetEmail,
      targetRole,
      action,
      performedBy: performedById,
      incumbentRole,
      reason: actionReason,
    });

    new OkResponseStrategy().handleResponse(res, {
      info: `Account ${action === "SUSPEND" ? "suspended" : "reactivated"} successfully`,
      userId: targetUser.id,
      role: targetRole,
      action,
      performedBy: performedById,
      performedAt: auditRecord.suspendedOn.toISOString(),
    });
  },
);
