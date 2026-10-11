import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { logger } from "@logger/logger.js";
import { decodeAdminToken } from "@controller/admin/helper/functions/index.js";
import {
  ADMIN_REFRESH_TOKEN_COOKIE_NAME,
  ADMIN_COOKIE_PATH,
} from "@controller/admin/constants/cookie.constants.js";

// ═══════════════════════════════════════════════════════════════════
// ADMIN LOGOUT
//
// Simple logout - just clears the refresh token cookie.
// Since we're not using Redis session storage, there's no server-side
// session to invalidate. The JWT tokens will naturally expire.
//
// Note: For immediate invalidation, you would need to implement
// a token blacklist (in Redis or database), but that adds complexity.
// ═══════════════════════════════════════════════════════════════════

export const adminLogout = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const refreshToken = req.cookies?.[ADMIN_REFRESH_TOKEN_COOKIE_NAME];

    if (refreshToken) {
      const decoded = decodeAdminToken(refreshToken);
      if (decoded) {
        logger.info("Admin logged out", { adminId: decoded.adminId });
      }
    }

    // Clear the refresh token cookie
    res.clearCookie(ADMIN_REFRESH_TOKEN_COOKIE_NAME, { path: ADMIN_COOKIE_PATH });

    new OkResponseStrategy().handleResponse(res, {
      info: "Logged out successfully",
    });
  },
);
