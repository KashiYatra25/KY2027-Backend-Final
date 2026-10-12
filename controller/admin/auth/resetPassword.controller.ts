import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { OkResponseStrategy } from "zodex-axon/responses";
import { logger } from "@logger/logger.js";
import { prisma } from "@root/prisma.js";
import { VerificationTokenModel } from "@root/databaseManagers/mongoose/index.js";
import { CryptoService } from "@helper/functions/crypto.helper.js";
import type { ResetPasswordRequestSchemaType } from "@schemas/admin/forgotPassword.schema.js";

// ═══════════════════════════════════════════════════════════════════
// RESET PASSWORD CONTROLLER
//
// Public endpoint - no auth required.
// User submits token (from email), email, and new password.
//
// Flow:
// 1. Find user by email
// 2. Verify user is an admin
// 3. Find valid token for this user (hashed comparison)
// 4. Verify new password is different from old password
// 5. Hash and update password
// 6. Delete used token
// 7. Return success
//
// Security:
// - Token must match user's userId (prevents changing other user's password)
// - Token must not be expired
// - New password must be different from old
// - Token is one-time use (deleted after success)
// ═══════════════════════════════════════════════════════════════════

export const resetPassword = catchAsync(
  async (
    req: VerifiedRequest<{ body: ResetPasswordRequestSchemaType }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { token, email, newPassword } = req.validatedData;

    // ─────────────────────────────────────────────────────────────────
    // Step 1: Find user by email
    // ─────────────────────────────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        admin: {
          select: {
            id: true,
            password: true,
          },
        },
        role: {
          select: { level: true },
        },
      },
    });

    if (!user) {
      logger.warn("Reset password - user not found", { email });
      return next(
        new NotFound().handleResponse(res, {
          info: "Invalid or expired reset link. Please request a new one.",
          code: "INVALID_RESET_LINK",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Step 2: Verify user is an admin
    // ─────────────────────────────────────────────────────────────────
    if (!user.admin || !user.role || user.role.level === "USER") {
      logger.warn("Reset password - user is not an admin", { email });
      return next(
        new BadRequest().handleResponse(res, {
          info: "Invalid or expired reset link. Please request a new one.",
          code: "INVALID_RESET_LINK",
        }),
      );
    }

    const userId = user.id;
    const adminId = user.admin.id;
    const currentHashedPassword = user.admin.password;

    // ─────────────────────────────────────────────────────────────────
    // Step 3: Find valid token for this user
    // Token must:
    // - Belong to this userId
    // - Be of type ADMIN_FORGOT_PASSWORD
    // - Not be expired
    // - Match the provided token (hashed comparison)
    // ─────────────────────────────────────────────────────────────────
    const tokenRecord = await VerificationTokenModel.findOne({
      userId,
      tokenType: "ADMIN_FORGOT_PASSWORD",
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .select("+tokenValue");

    if (!tokenRecord) {
      logger.warn("Reset password - no valid token found", { userId });
      return next(
        new BadRequest().handleResponse(res, {
          info: "Invalid or expired reset link. Please request a new one.",
          code: "TOKEN_EXPIRED",
        }),
      );
    }

    // Verify token hash matches
    const isTokenValid = await CryptoService.verify(token, tokenRecord.tokenValue);

    if (!isTokenValid) {
      logger.warn("Reset password - token mismatch", { userId });
      return next(
        new BadRequest().handleResponse(res, {
          info: "Invalid or expired reset link. Please request a new one.",
          code: "INVALID_TOKEN",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Step 4: Verify new password is different from old password
    // ─────────────────────────────────────────────────────────────────
    const isSamePassword = await CryptoService.verify(newPassword, currentHashedPassword);

    if (isSamePassword) {
      logger.warn("Reset password - new password same as old", { userId });
      return next(
        new BadRequest().handleResponse(res, {
          info: "New password must be different from your current password.",
          code: "SAME_PASSWORD",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Step 5: Hash and update password
    // ─────────────────────────────────────────────────────────────────
    const hashedNewPassword = await CryptoService.hash(newPassword);

    await prisma.admin.update({
      where: { id: adminId },
      data: { password: hashedNewPassword },
    });

    // ─────────────────────────────────────────────────────────────────
    // Step 6: Delete used token (one-time use)
    // ─────────────────────────────────────────────────────────────────
    await VerificationTokenModel.deleteOne({ _id: tokenRecord._id });

    logger.info("Password reset successful", { userId, adminId });

    // ─────────────────────────────────────────────────────────────────
    // Step 7: Return success
    // ─────────────────────────────────────────────────────────────────
    new OkResponseStrategy().handleResponse(res, {
      info: "Password reset successfully. You can now login with your new password.",
    });
  },
);
