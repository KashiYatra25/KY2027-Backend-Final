import type { AdminOnboardingRequestSchemaType } from "@schemas/admin/admin.schema.js";
import { CryptoService } from "@helper/functions/crypto.helper.js";
import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { BadRequest } from "zodex-axon/errors";
import { OkResponseStrategy } from "zodex-axon/responses";
import { logger } from "@logger/logger.js";
import { generateAdminTokens } from "@controller/admin/helper/functions/index.js";
import { VerificationTokenModel } from "@root/databaseManagers/mongoose/index.js";
import {
  ADMIN_REFRESH_TOKEN_COOKIE_NAME,
  ADMIN_COOKIE_OPTIONS,
} from "@controller/admin/constants/cookie.constants.js";

// ═══════════════════════════════════════════════════════════════════
// VERIFY ADMIN CREDENTIALS & ISSUE JWT (Onboarding)
//
// Prerequisites (checked by middleware):
// 1. User is authenticated (NextAuth session)
// 2. User has valid admin role (MASTER_ADMIN, MANAGER, OPERATOR)
// 3. Admin record exists in database (validateUserIsAdmin middleware)
//
// This controller:
// 1. Verifies login token (from email link) - uses NEWEST non-expired token
// 2. Verifies password
// 3. Generates and issues JWT tokens
// 4. Deletes the used token (one-time use)
//
// Response includes accessToken in body for frontend storage in memory.
// Refresh token is set as HttpOnly cookie.
// ═══════════════════════════════════════════════════════════════════

export const confirmAdminOnboarding = catchAsync(
  async (
    req: VerifiedRequest<
      { body: AdminOnboardingRequestSchemaType },
    >,
    res: Response,
    next: NextFunction,
  ) => {
    const { adminPassword, loginToken } = req.validatedData;
    const { hashedPassword, adminId } = req.adminData;
    const { id: userId, email, role } = req.user;

    // ─────────────────────────────────────────────────────────────────
    // Find the NEWEST non-expired token for this user
    // Sorted by createdAt descending - newest first
    // ─────────────────────────────────────────────────────────────────
    const tokenRecord = await VerificationTokenModel.findOne({
      userId,
      tokenType: "ADMIN_LOGIN_URL_TOKEN",
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .select("+tokenValue");

    if (!tokenRecord) {
      logger.warn("Admin onboarding - no valid token found", { userId, adminId });
      return next(
        new BadRequest().handleResponse(res, {
          info: "Invalid or expired login link. Please request a new one.",
          code: "TOKEN_NOT_FOUND",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Verify token hash matches the newest token
    // ─────────────────────────────────────────────────────────────────
    const isTokenValid = await CryptoService.verify(
      loginToken,
      tokenRecord.tokenValue,
    );

    if (!isTokenValid) {
      logger.warn("Admin onboarding - token mismatch", { userId, adminId });
      return next(
        new BadRequest().handleResponse(res, {
          info: "Invalid login link. Please use the most recent one from your email.",
          code: "INVALID_TOKEN",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Verify password
    // ─────────────────────────────────────────────────────────────────
    const isPasswordValid = await CryptoService.verify(
      adminPassword,
      hashedPassword,
    );

    if (!isPasswordValid) {
      logger.warn("Admin onboarding - invalid password", { userId, adminId });
      return next(
        new BadRequest().handleResponse(res, {
          info: "Invalid admin credentials.",
          code: "INVALID_PASSWORD",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Delete the used token (one-time use)
    // ─────────────────────────────────────────────────────────────────
    await VerificationTokenModel.deleteOne({ _id: tokenRecord._id });
    logger.debug("Deleted used login token", { userId, tokenId: tokenRecord._id });

    // ─────────────────────────────────────────────────────────────────
    // Generate JWT tokens
    // ─────────────────────────────────────────────────────────────────
    const tokens = generateAdminTokens({
      adminId,
      email,
      role,
    });

    // ─────────────────────────────────────────────────────────────────
    // Set refresh token as HttpOnly cookie
    // ─────────────────────────────────────────────────────────────────
    res.cookie(
      ADMIN_REFRESH_TOKEN_COOKIE_NAME,
      tokens.refreshToken,
      ADMIN_COOKIE_OPTIONS,
    );

    logger.info("Admin onboarded successfully", { userId, adminId, role });

    new OkResponseStrategy().handleResponse(res, {
      info: "Admin authenticated successfully",
      admin: { email, role },
      accessToken: tokens.accessToken,
      accessTokenExpiry: tokens.accessTokenExpiry,
    });
  },
);
