import type { AdminOnboardingRequestSchemaType } from "@schemas/admin/admin.schema.js";
import { CryptoService } from "@helper/functions/crypto.helper.js";
import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { OkResponseStrategy } from "zodex-axon/responses";
import { logger } from "@logger/logger.js";
import { generateAdminTokens } from "@controller/admin/helper/functions/index.js";
import { VerificationTokenModel } from "@root/databaseManagers/mongoose/index.js";
import { prisma } from "@root/prisma.js";
import {
  ADMIN_REFRESH_TOKEN_COOKIE_NAME,
  ADMIN_COOKIE_OPTIONS,
} from "@controller/admin/constants/cookie.constants.js";

// ═══════════════════════════════════════════════════════════════════
// CONFIRM ADMIN ONBOARDING
//
// Public endpoint - no auth required.
// User provides email + password + token (from email link).
//
// Flow:
// 1. Find user by email
// 2. Verify user has admin role
// 3. Verify login token (from email link)
// 4. Verify password matches stored hash
// 5. Generate and issue JWT tokens
// 6. Delete the used token (one-time use)
//
// Response includes accessToken in body for frontend storage.
// Refresh token is set as HttpOnly cookie.
// ═══════════════════════════════════════════════════════════════════

export const confirmAdminOnboarding = catchAsync(
  async (
    req: VerifiedRequest<{ body: AdminOnboardingRequestSchemaType }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { email, adminPassword, loginToken } = req.validatedData;

    // ─────────────────────────────────────────────────────────────────
    // Step 1: Find user by email
    // ─────────────────────────────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: {
          select: {
            level: true,
          },
        },
        admin: {
          select: {
            id: true,
            password: true,
          },
        },
      },
    });

    if (!user) {
      logger.warn("Admin onboarding - user not found", { email });
      return next(
        new NotFound().handleResponse(res, {
          info: "User not found",
          code: "USER_NOT_FOUND",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Step 2: Verify user has admin role
    // ─────────────────────────────────────────────────────────────────
    const role = user.role?.level;
    if (!role || role === "USER") {
      logger.warn("Admin onboarding - user is not an admin", { email, role });
      return next(
        new BadRequest().handleResponse(res, {
          info: "You do not have admin access",
          code: "NOT_ADMIN",
        }),
      );
    }

    if (!user.admin) {
      logger.warn("Admin onboarding - admin record not found", { email });
      return next(
        new BadRequest().handleResponse(res, {
          info: "Admin profile not found",
          code: "ADMIN_NOT_FOUND",
        }),
      );
    }

    const { id: userId } = user;
    const { id: adminId, password: hashedPassword } = user.admin;

    // ─────────────────────────────────────────────────────────────────
    // Step 3: Find the NEWEST non-expired token for this user
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
    // Step 4: Verify token hash matches
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
    // Step 5: Verify password
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
    // Step 6: Delete the used token (one-time use)
    // ─────────────────────────────────────────────────────────────────
    await VerificationTokenModel.deleteOne({ _id: tokenRecord._id });
    logger.debug("Deleted used login token", { userId, tokenId: tokenRecord._id });

    // ─────────────────────────────────────────────────────────────────
    // Step 7: Generate JWT tokens
    // ─────────────────────────────────────────────────────────────────
    const tokens = generateAdminTokens({
      userId,
      adminId,
      email,
      role,
    });

    // ─────────────────────────────────────────────────────────────────
    // Step 8: Set refresh token as HttpOnly cookie
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
