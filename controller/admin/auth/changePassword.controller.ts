import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { BadRequest } from "zodex-axon/errors";
import { OkResponseStrategy } from "zodex-axon/responses";
import { logger } from "@logger/logger.js";
import { prisma } from "@root/prisma.js";
import { CryptoService } from "@helper/functions/crypto.helper.js";
import type { ChangePasswordRequestSchemaType } from "@schemas/admin/changePassword.schema.js";
import type { AdminRequestWithVerifiedCreds } from "@middleware/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// CHANGE PASSWORD CONTROLLER
//
// Protected endpoint - requires admin JWT.
// Allows authenticated admin to change their password.
//
// Flow:
// 1. Get admin from request (set by adminRoutesRESTProtectMiddleware)
// 2. Verify current password matches
// 3. Verify new password is different from current
// 4. Hash and update password
// 5. Return success
//
// Security:
// - Requires valid admin JWT
// - Must verify current password before allowing change
// - New password must be different from current
// ═══════════════════════════════════════════════════════════════════

export const changePassword = catchAsync(
  async (
    req: VerifiedRequest<{ body: ChangePasswordRequestSchemaType }> &
      AdminRequestWithVerifiedCreds,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { currentPassword, newPassword } = req.validatedData;
    const adminId = req.admin.adminId;

    // ─────────────────────────────────────────────────────────────────
    // Step 1: Get admin's current password hash from database
    // ─────────────────────────────────────────────────────────────────
    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        password: true,
        user: {
          select: { id: true },
        },
      },
    });

    if (!admin) {
      logger.warn("Change password - admin not found", { adminId });
      return next(
        new BadRequest().handleResponse(res, {
          info: "Admin account not found.",
          code: "ADMIN_NOT_FOUND",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Step 2: Verify current password matches
    // ─────────────────────────────────────────────────────────────────
    const isCurrentPasswordValid = await CryptoService.verify(
      currentPassword,
      admin.password,
    );

    if (!isCurrentPasswordValid) {
      logger.warn("Change password - incorrect current password", { adminId });
      return next(
        new BadRequest().handleResponse(res, {
          info: "Current password is incorrect.",
          code: "INCORRECT_PASSWORD",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Step 3: Verify new password is different from current
    // ─────────────────────────────────────────────────────────────────
    const isSamePassword = await CryptoService.verify(newPassword, admin.password);

    if (isSamePassword) {
      logger.warn("Change password - new password same as current", { adminId });
      return next(
        new BadRequest().handleResponse(res, {
          info: "New password must be different from your current password.",
          code: "SAME_PASSWORD",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Step 4: Hash and update password
    // ─────────────────────────────────────────────────────────────────
    const hashedNewPassword = await CryptoService.hash(newPassword);

    await prisma.admin.update({
      where: { id: adminId },
      data: { password: hashedNewPassword },
    });

    logger.info("Password changed successfully", { adminId });

    // ─────────────────────────────────────────────────────────────────
    // Step 5: Return success
    // ─────────────────────────────────────────────────────────────────
    new OkResponseStrategy().handleResponse(res, {
      info: "Password changed successfully.",
    });
  },
);
