import { prisma } from "@root/prisma";
import { CryptoService } from "@utils/helper/crypto.encryption.helper.js";
import type { Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import type { AdminInviteRequestWithTargetUser } from "@root/controller/middleware/admin/invite";

/**
 * Make a user an admin - creates admin record and updates role
 */
export const makeUserAdmin = catchAsync(
  async (
    req: AdminInviteRequestWithTargetUser,
    res: Response,
  ): Promise<void> => {
    const { targetUserId, targetRole } = req.targetAdminUser;

    const tempPassword = CryptoService.generateTempPassword();
    const hashedPassword = await CryptoService.hash(tempPassword);

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
      });

      const newAdmin = await tx.admin.create({
        data: {
          userId: user.id,
          password: hashedPassword,
        },
      });

      return { user, newAdmin };
    });

    // TODO: Send email via BullMQ
    // await new SendAdminInviteEmail(
    //   { name: userName, email },
    //   tempPassword,
    // ).SendEmail();

    new OkResponseStrategy().handleResponse(res, {
      info: "Admin invite sent successfully to existing user",
    });
  },
);
