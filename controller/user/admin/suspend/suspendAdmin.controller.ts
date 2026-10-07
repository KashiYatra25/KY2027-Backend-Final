import { prisma } from "@root/prisma";
import type { Response } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { logger } from "@logger/index.js";
import {
  AdminSecurityStepperModel,
  AccountProgressModel,
  AccountSuspensionModel,
} from "@root/databaseManagers/mongoose";
import type { AdminSuspendSchemaType } from "@schemas/admin/admin.schema.js";
import type { AdminSuspendRequestWithTargetUser } from "@middleware/admin/suspend/types.js";

/**
 * Suspend an admin - removes admin record and demotes role to USER
 * Uses Prisma transaction for PostgreSQL and parallel MongoDB operations
 */
export const suspendAdmin = catchAsync(
  async (
    req: VerifiedRequest<
      { body: AdminSuspendSchemaType },
      AdminSuspendRequestWithTargetUser
    >,
    res: Response,
  ): Promise<void> => {
    const { targetUserId, targetAdminId, targetRole } = req.targetAdmin;
    const { id: suspendedBy } = req.user;
    const { reason } = req.validatedData;

    const [prismaResult, mongoResults] = await Promise.all([
      // Prisma transaction - delete admin and demote role
      prisma.$transaction(async (tx) => {
        const deletedAdmin = await tx.admin.delete({
          where: { id: targetAdminId },
        });

        const updatedRole = await tx.role.update({
          where: { userId: targetUserId },
          data: { level: "USER" },
        });

        return { deletedAdmin, updatedRole };
      }),

      // MongoDB operations (parallel, non-transactional for compatibility)
      Promise.all([
        AccountProgressModel.findOneAndUpdate(
          { userId: targetUserId },
          { accountStatus: "SUSPENDED" },
          { returnDocument: "after" },
        ),
        AccountSuspensionModel.create({
          userId: targetUserId,
          suspendedBy,
          reason: reason || "No reason provided",
          suspendedOn: new Date(),
        }),
        AdminSecurityStepperModel.findOneAndDelete({ userId: targetUserId }),
      ]),
    ]);

    new OkResponseStrategy().handleResponse(res, {
      info: `Admin ${targetRole} has been suspended successfully`,
      data: {
        suspendedUserId: targetUserId,
        previousRole: targetRole,
        newRole: "USER",
        suspendedBy,
        suspendedOn: new Date().toISOString(),
      },
    });

    logger.info("Admin suspended", {
      suspendedUserId: targetUserId,
      suspendedAdminId: targetAdminId,
      previousRole: targetRole,
      suspendedBy,
      reason: reason ?? "No reason provided",
    });
  },
);
