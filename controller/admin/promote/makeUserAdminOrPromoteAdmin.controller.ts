import { prisma } from "@root/prisma";
import { CryptoService } from "@helper/functions/crypto.helper.js";
import type { Response, Request } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { logger } from "@logger/logger.js";
// NOTE: The module "@root/controller/middleware/admin/invite" does not exist.
// The invite middleware that attaches `targetAdminUser` has not been implemented yet.
// Defining a local request type here so this controller type-checks until that
// middleware is created and this import can be restored.
// import type { AdminInviteRequestWithTargetUser } from "@root/controller/middleware/admin/invite";
import type { RoleLevel } from "@lib/prisma/index.js";
import { queueAdminOnboardCredsEmail } from "@services/queue/index.js";
import { env } from "@lib/env/environment.js";
import { VerificationTokenModel } from "@lib/mongo/index.js";

// Local type: request augmented by the admin-invite middleware.
interface AdminInviteRequestWithTargetUser extends Request {
  targetAdminUser: {
    targetUserId: string;
    targetRole: RoleLevel;
    targetEmail: string;
    targetName?: string;
  };
  user: {
    id: string;
  };
}

// ═══════════════════════════════════════════════════════════════════
// MAKE USER ADMIN
// 
// Promotes a user to admin role and sends invite email via BullMQ.
// The email is queued asynchronously so the API responds instantly.
// ═══════════════════════════════════════════════════════════════════

export const makeUserAdminOrPromoteAdmin = catchAsync(
  async (
    req: AdminInviteRequestWithTargetUser,
    res: Response,
  ): Promise<void> => {
    const { targetUserId, targetRole, targetEmail, targetName } = req.targetAdminUser;

    // Generate temporary password
    const tempPassword = CryptoService.generateTempPassword();
    const hashedPassword = await CryptoService.hash(tempPassword);

    // Generate login token for email verification link
    const loginToken = CryptoService.generateRandomToken(32);
    const hashedLoginToken = await CryptoService.hash(loginToken);

    // Create admin record and update user role in transaction
    const { user, newAdmin } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: targetUserId },
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

    // Store login token in MongoDB (expires in 10 minutes)
    // Note: Old tokens cleaned up by cron job - we just use newest token for verification
    await VerificationTokenModel.create({
      userId: targetUserId,
      tokenType: "ADMIN_LOGIN_URL_TOKEN",
      tokenValue: hashedLoginToken,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    // Build login URL with token
    const loginUrl = `${env.CLIENT_ADMIN_PANEL_ORIGIN}/admin-verification/${loginToken}`;

    // Queue email via BullMQ (async - doesn't block response)
    const userName = targetName || user.firstName || user.slugName || "Admin";
    
    const jobId = await queueAdminOnboardCredsEmail({
      userName,
      email: targetEmail,
      tempPassword,
      loginUrl,
    });

    logger.info("User promoted to admin, invite email queued", {
      promotedBy: req.user.id,
      targetUserId,
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
