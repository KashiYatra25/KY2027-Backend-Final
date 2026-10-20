import { prisma } from "@root/prisma.js";
import { CryptoService } from "@helper/functions/crypto.helper.js";
import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest, NotFound, ForbiddenErrorResponse } from "zodex-axon/errors";
import { logger } from "@logger/logger.js";
import { queueAdminOnboardCredsEmail } from "@services/queue/index.js";
import { env } from "@lib/env/environment.js";
import { VerificationTokenModel } from "@lib/mongo/index.js";
import type { PromoteUserOrAdminRoleRequestSchemaType } from "@schemas/admin/admin.schema.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// CONVERT USER TO ADMIN
// 
// Promotes a regular user to admin role (MANAGER or OPERATOR).
// Sends invite email with temporary password via BullMQ.
//
// Hierarchy:
// - MASTER_ADMIN can promote to: MANAGER, OPERATOR
// - MANAGER can promote to: OPERATOR only
// ═══════════════════════════════════════════════════════════════════

export const makeUserAdminOrPromoteAdmin = catchAsync(
  async (
    req: VerifiedRequest<
      { body: PromoteUserOrAdminRoleRequestSchemaType },
      AdminRequestWithVerifiedCreds
    >,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { targetEmail, role: targetRole } = req.validatedData;
    const requestingAdmin = req.admin;

    // 1. Check if requesting admin has permission to assign this role
    if (requestingAdmin.role === "MANAGER" && targetRole === "MANAGER") {
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: "Managers can only promote users to Operator role",
        }),
      );
    }

    // 2. Find the target user
    const targetUser = await prisma.user.findUnique({
      where: { email: targetEmail },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        slugName: true,
        isSuspended: true,
        role: {
          select: { level: true },
        },
        admin: {
          select: { id: true },
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

    // 3. Check if user is suspended
    if (targetUser.isSuspended) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Cannot promote a suspended user",
        }),
      );
    }

    // 5. Check if user is already an admin
    if (targetUser.admin) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "User is already an admin",
          currentRole: targetUser.role?.level,
        }),
      );
    }

    // 6. Generate temporary password and login token
    const tempPassword = CryptoService.generateTempPassword();
    const hashedPassword = await CryptoService.hash(tempPassword);
    const loginToken = CryptoService.generateRandomToken(32);
    const hashedLoginToken = await CryptoService.hash(loginToken);

    // 7. Create admin record and update user role in transaction
    const { user, newAdmin } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: targetUser.id },
        data: {
          role: {
            upsert: {
              create: { level: targetRole },
              update: { level: targetRole },
            },
          },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          slugName: true,
        },
      });

      const newAdmin = await tx.admin.create({
        data: {
          userId: user.id,
          password: hashedPassword,
        },
      });

      return { user, newAdmin };
    });

    // 8. Store login token in MongoDB (expires in 10 minutes)
    await VerificationTokenModel.create({
      userId: targetUser.id,
      tokenType: "ADMIN_LOGIN_URL_TOKEN",
      tokenValue: hashedLoginToken,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    // 9. Build login URL with token
    const loginUrl = `${env.CLIENT_ADMIN_PANEL_ORIGIN}/admin-verification/${loginToken}`;

    // 10. Queue email via BullMQ (async - doesn't block response)
    const userName = targetUser.firstName || targetUser.slugName || "Admin";
    
    const jobId = await queueAdminOnboardCredsEmail({
      userName,
      email: targetEmail,
      tempPassword,
      loginUrl,
    });

    logger.info("User promoted to admin, invite email queued", {
      promotedBy: requestingAdmin.userId,
      targetUserId: targetUser.id,
      targetRole,
      adminId: newAdmin.id,
      emailJobId: jobId,
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Admin invite sent successfully",
      adminId: newAdmin.id,
      userId: user.id,
      role: targetRole,
      emailJobId: jobId,
    });
  },
);
