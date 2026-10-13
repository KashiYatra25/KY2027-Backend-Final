import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { logger } from "@logger/logger.js";
import { decodeAdminToken } from "@controller/admin/helper/functions/index.js";
import { revokeAdminRefreshTokens } from "@services/redis/adminToken.service.js";
import {
  ADMIN_REFRESH_TOKEN_COOKIE_NAME,
  ADMIN_COOKIE_PATH,
} from "@controller/admin/constants/cookie.constants.js";

// ═══════════════════════════════════════════════════════════════════
// ADMIN LOGOUT
//
// Revokes the admin session by deleting the stored refresh token JTI
// from Redis, then clears the refresh token cookie.
//
// After this, any access token still held by the client will be
// rejected by the guards because its correlated refresh JTI no longer
// exists in Redis, and the refresh endpoint will refuse to issue new
// tokens.
// ═══════════════════════════════════════════════════════════════════

export const adminLogout = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const refreshToken = req.cookies?.[ADMIN_REFRESH_TOKEN_COOKIE_NAME];

    if (refreshToken) {
      const decoded = decodeAdminToken(refreshToken);
      if (decoded?.userId) {
        // Immediately revoke the session server-side.
        await revokeAdminRefreshTokens(decoded.userId);
        logger.info("Admin logged out", {
          adminId: decoded.adminId,
          userId: decoded.userId,
        });
      }
    }

    // Clear the refresh token cookie
    res.clearCookie(ADMIN_REFRESH_TOKEN_COOKIE_NAME, { path: ADMIN_COOKIE_PATH });

    new OkResponseStrategy().handleResponse(res, {
      info: "Logged out successfully",
    });
  },
);
