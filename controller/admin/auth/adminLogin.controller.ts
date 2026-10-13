import type { AdminLoginRequestSchemaType } from "@schemas/admin/admin.schema.js";
import {
  generateAdminTokens,
  getAdminTokenId,
} from "@controller/admin/helper/functions/index.js";
import { storeAdminRefreshJti } from "@services/redis/adminToken.service.js";
import { logger } from "@logger/logger.js";
import { prisma } from "@root/prisma.js";
import { CryptoService } from "@helper/functions/crypto.helper.js";
import type { NextFunction, Response } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { BadRequest } from "zodex-axon/errors";
import { OkResponseStrategy } from "zodex-axon/responses";
import {
  ADMIN_COOKIE_OPTIONS,
  ADMIN_REFRESH_TOKEN_COOKIE_NAME,
} from "@controller/admin/constants/cookie.constants.js";
import { VALID_ADMIN_ROLES } from "@controller/admin/constants/roles.constants.js";
import { INVALID_CREDENTIALS_ERROR } from "@controller/admin/constants/genericAuthErrors.constants.js";

// ═══════════════════════════════════════════════════════════════════
// ADMIN LOGIN WITH EMAIL + PASSWORD (Standalone)
//
// Standalone login endpoint for admin dashboard.
// Does NOT require NextAuth session - admin can login directly.
//
// Use case: Admin cleared browser data but knows their credentials.
// They should still be able to login to the admin panel.
//
// Flow:
// 1. Find user by email
// 2. Verify user has admin role
// 3. Find admin record
// 4. Verify password
// 5. Issue JWT tokens
// ═══════════════════════════════════════════════════════════════════

export const adminLogin = catchAsync(
  async (
    req: VerifiedRequest<{ body: AdminLoginRequestSchemaType }>,
    res: Response,
    next: NextFunction,
  ) => {
    const { email, password } = req.validatedData;

    // ─────────────────────────────────────────────────────────────────
    // Find user by email and check if they have admin role
    // ─────────────────────────────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: { select: { level: true } },
        isSuspended: true,
      },
    });

    if (!user) {
      logger.debug("Admin login attempt - user not found", { email });
      return next(
        new BadRequest().handleResponse(res, INVALID_CREDENTIALS_ERROR),
      );
    }

    // Check if user is suspended - block login
    if (user.isSuspended) {
      logger.warn("Admin login attempt - account suspended", { email, userId: user.id });
      return next(
        new BadRequest().handleResponse(res, {
          info: "Your account has been suspended. Please contact the administrator.",
          code: "ACCOUNT_SUSPENDED",
        }),
      );
    }

    const userRole = user.role?.level;
    if (!userRole || !VALID_ADMIN_ROLES.includes(userRole)) {
      logger.debug("Admin login attempt - not an admin", { email, userId: user.id, role: userRole });
      return next(
        new BadRequest().handleResponse(res, INVALID_CREDENTIALS_ERROR),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Find admin record
    // ─────────────────────────────────────────────────────────────────
    const admin = await prisma.admin.findUnique({
      where: { userId: user.id },
      select: { id: true, password: true },
    });

    if (!admin) {
      logger.warn("Admin login attempt - admin record not found", { email, userId: user.id });
      return next(
        new BadRequest().handleResponse(res, INVALID_CREDENTIALS_ERROR),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Verify password
    // ─────────────────────────────────────────────────────────────────
    const isPasswordValid = await CryptoService.verify(password, admin.password);

    if (!isPasswordValid) {
      logger.warn("Admin login attempt - invalid password", { email, userId: user.id, adminId: admin.id });
      return next(
        new BadRequest().handleResponse(res, INVALID_CREDENTIALS_ERROR),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Generate JWT tokens
    // ─────────────────────────────────────────────────────────────────
    const tokens = generateAdminTokens({
      userId: user.id,
      adminId: admin.id,
      email: user.email,
      role: userRole,
    });

    // ─────────────────────────────────────────────────────────────────
    // Persist the refresh token JTI in Redis so the session can be
    // revoked on logout / password change and validated by the guards.
    // ─────────────────────────────────────────────────────────────────
    const refreshJti = getAdminTokenId(tokens.refreshToken);
    if (refreshJti) {
      await storeAdminRefreshJti(user.id, refreshJti);
    }

    res.cookie(
      ADMIN_REFRESH_TOKEN_COOKIE_NAME,
      tokens.refreshToken,
      ADMIN_COOKIE_OPTIONS,
    );

    logger.info("Admin logged in via email+password", {
      email,
      userId: user.id,
      adminId: admin.id,
      role: userRole,
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Login successful",
      admin: { email: user.email, role: userRole },
      accessToken: tokens.accessToken,
      accessTokenExpiry: tokens.accessTokenExpiry,
    });
  },
);
