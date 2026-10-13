import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { UnauthorizedAccess } from "zodex-axon/errors";
import { OkResponseStrategy } from "zodex-axon/responses";
import { logger } from "@logger/logger.js";
import {
  verifyRefreshToken,
  generateAdminTokens,
  getAdminTokenId,
} from "@controller/admin/helper/functions/index.js";
import {
  isAdminRefreshJtiValid,
  storeAdminRefreshJti,
} from "@services/redis/adminToken.service.js";
import {
  ADMIN_REFRESH_TOKEN_COOKIE_NAME,
  ADMIN_COOKIE_PATH,
  ADMIN_COOKIE_OPTIONS,
} from "@controller/admin/constants/cookie.constants.js";

// ═══════════════════════════════════════════════════════════════════
// REFRESH ADMIN TOKEN (with Refresh Token Rotation)
//
// Returns accessToken in response body for frontend to store in memory.
// Frontend uses wire-axon RefreshTokenStrategy for automatic refresh.
//
// Security: Refresh token is rotated on each use, but keeps the same
// expiry time as the original token. This limits the attack window if
// a token is stolen - the attacker's token becomes invalid as soon as
// the legitimate user refreshes.
//
// Flow:
// 1. Extract refresh token from HttpOnly cookie
// 2. Verify refresh token is valid (signature, expiry)
// 3. Generate new access token AND new refresh token
// 4. Set new refresh token cookie (with remaining TTL from original)
// 5. Return new access token in response body
// ═══════════════════════════════════════════════════════════════════

export const refreshAdminToken = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    // ─────────────────────────────────────────────────────────────────
    // Step 1: Extract refresh token from cookie
    // ─────────────────────────────────────────────────────────────────
    const oldRefreshToken = req.cookies?.[ADMIN_REFRESH_TOKEN_COOKIE_NAME];

    if (!oldRefreshToken) {
      logger.warn("Admin token refresh - no refresh token in cookie");
      return next(
        new UnauthorizedAccess().handleResponse(res, {
          info: "No refresh token provided",
          code: "NO_REFRESH_TOKEN",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Step 2: Verify refresh token (signature + expiry)
    // ─────────────────────────────────────────────────────────────────
    const decoded = verifyRefreshToken(oldRefreshToken);

    if (!decoded) {
      logger.warn("Admin token refresh - invalid refresh token");
      res.clearCookie(ADMIN_REFRESH_TOKEN_COOKIE_NAME, { path: ADMIN_COOKIE_PATH });
      return next(
        new UnauthorizedAccess().handleResponse(res, {
          info: "Invalid or expired refresh token. Please login again.",
          code: "INVALID_REFRESH_TOKEN",
        }),
      );
    }

    const { userId, adminId, email, role, exp, jti } = decoded;

    // ─────────────────────────────────────────────────────────────────
    // Step 2b: Ensure this refresh token has not been revoked.
    // The valid refresh JTI is tracked in Redis. If it is missing (logout,
    // password change, expiry) or does not match the presented token, the
    // session is no longer valid and we must refuse to rotate.
    // ─────────────────────────────────────────────────────────────────
    const isValid = await isAdminRefreshJtiValid(userId, jti);

    if (!isValid) {
      logger.warn("Admin token refresh - refresh JTI revoked or not found", {
        adminId,
        userId,
      });
      res.clearCookie(ADMIN_REFRESH_TOKEN_COOKIE_NAME, { path: ADMIN_COOKIE_PATH });
      return next(
        new UnauthorizedAccess().handleResponse(res, {
          info: "Admin session has been invalidated. Please login again.",
          code: "ADMIN_SESSION_INVALIDATED",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Step 3: Generate new tokens (both access and refresh)
    // ─────────────────────────────────────────────────────────────────
    const tokens = generateAdminTokens({
      userId,
      adminId,
      email,
      role,
    });

    // ─────────────────────────────────────────────────────────────────
    // Step 3b: Rotate the stored refresh JTI so the old refresh token can
    // no longer be used (refresh token rotation).
    // ─────────────────────────────────────────────────────────────────
    const newRefreshJti = getAdminTokenId(tokens.refreshToken);
    if (newRefreshJti) {
      await storeAdminRefreshJti(userId, newRefreshJti);
    }

    // ─────────────────────────────────────────────────────────────────
    // Step 4: Calculate remaining TTL and set new refresh token cookie
    // Keep the same expiry as the original token (don't extend session)
    // ─────────────────────────────────────────────────────────────────
    const now = Math.floor(Date.now() / 1000);
    const remainingTTL = exp - now; // seconds until original expiry
    const remainingTTLMs = remainingTTL * 1000; // convert to milliseconds for cookie maxAge

    res.cookie(ADMIN_REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken, {
      ...ADMIN_COOKIE_OPTIONS,
      maxAge: remainingTTLMs, // Use remaining TTL, not full TTL
    });

    logger.debug("Admin tokens refreshed (with rotation)", {
      adminId,
      remainingTTL: `${Math.round(remainingTTL / 60)} minutes`,
    });

    // ─────────────────────────────────────────────────────────────────
    // Step 5: Return new access token in response body
    // ─────────────────────────────────────────────────────────────────
    new OkResponseStrategy().handleResponse(res, {
      info: "Token refreshed successfully",
      accessToken: tokens.accessToken,
      accessTokenExpiry: tokens.accessTokenExpiry,
    });
  },
);
