import type { NextFunction, Response, Request } from "express";
import { catchAsync } from "zodex-axon/core";
import { UnauthorizedAccess, ForbiddenErrorResponse } from "zodex-axon/errors";
import { logger } from "@logger/logger.js";
import {
  verifyAccessToken,
  decodeAdminToken,
} from "@controller/admin/helper/functions/index.js";
import {
  isAdminRefreshJtiValid,
  toRefreshJti,
} from "@services/redis/adminToken.service.js";
import type { AdminRequestWithVerifiedCreds } from "@root/middleware/admin/helper/types/jwt.types";
// ═══════════════════════════════════════════════════════════════════
// ADMIN JWT VERIFICATION MIDDLEWARE
//
// Error Codes for Frontend:
// - ADMIN_TOKEN_MISSING: No Authorization header
// - ADMIN_TOKEN_EXPIRED: Token exists but is expired → auto-refresh
// - ADMIN_TOKEN_INVALID: Token is malformed/tampered → re-login required
// - ADMIN_SESSION_INVALIDATED: Session was revoked → re-login required
// ═══════════════════════════════════════════════════════════════════

/**
 * Middleware to verify admin JWT access token from Authorization header.
 *
 * This is SEPARATE from userRoutesRESTProtectMiddleware (NextAuth session).
 * Admin routes require BOTH:
 * 1. Valid NextAuth session (userRoutesRESTProtectMiddleware)
 * 2. Valid Admin JWT (this middleware)
 *
 * This provides step-up authentication for admin operations.
 */
export const adminRoutesRESTProtectMiddleware = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.warn("Admin JWT missing or malformed", {
        path: req.path,
        hasHeader: !!authHeader,
      });
      return next(
        new UnauthorizedAccess().handleResponse(res, {
          info: "Admin authentication required. Please login to the admin panel.",
          code: "ADMIN_TOKEN_MISSING",
        }),
      );
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix

    // ─────────────────────────────────────────────────────────────────
    // First, decode without verification to check expiry
    // This lets us distinguish between expired and invalid tokens
    // ─────────────────────────────────────────────────────────────────
    const decodedWithoutVerify = decodeAdminToken(token);

    if (!decodedWithoutVerify) {
      // Token is completely malformed/invalid
      logger.warn("Admin JWT malformed - cannot decode", {
        path: req.path,
        tokenPreview: token.slice(0, 20) + "...",
      });
      return next(
        new UnauthorizedAccess().handleResponse(res, {
          info: "Invalid admin token. Please login again.",
          code: "ADMIN_TOKEN_INVALID",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Verify the access token (checks signature + expiry)
    // ─────────────────────────────────────────────────────────────────
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      // Token decoded but verification failed - check if expired
      const now = Math.floor(Date.now() / 1000);

      if (decodedWithoutVerify.exp && decodedWithoutVerify.exp < now) {
        // Token is expired - frontend should auto-refresh
        logger.debug("Admin JWT expired - can refresh", {
          path: req.path,
          userId: decodedWithoutVerify.userId,
          expiredAt: new Date(decodedWithoutVerify.exp * 1000).toISOString(),
        });
        return next(
          new UnauthorizedAccess().handleResponse(res, {
            info: "Admin token expired. Refreshing...",
            code: "ADMIN_TOKEN_EXPIRED",
          }),
        );
      }

      // Token signature invalid or other verification failure
      logger.warn("Admin JWT verification failed - invalid signature", {
        path: req.path,
        tokenPreview: token.slice(0, 20) + "...",
      });
      return next(
        new UnauthorizedAccess().handleResponse(res, {
          info: "Invalid admin token. Please login again.",
          code: "ADMIN_TOKEN_INVALID",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // Session revocation check:
    // The access token shares a base jti with its refresh token
    // ("access_<base>" / "refresh_<base>"). We verify the correlated
    // refresh jti is still the one stored in Redis. If the admin logged
    // out or changed their password, the stored jti is gone/different and
    // the access token must be rejected even though it is still within
    // its signature validity window.
    // ─────────────────────────────────────────────────────────────────
    const refreshJti = toRefreshJti(decoded.jti);

    if (!refreshJti || !(await isAdminRefreshJtiValid(decoded.userId, refreshJti))) {
      logger.warn("Admin JWT rejected - session invalidated", {
        path: req.path,
        userId: decoded.userId,
        adminId: decoded.adminId,
      });
      return next(
        new UnauthorizedAccess().handleResponse(res, {
          info: "Admin session has been invalidated. Please login again.",
          code: "ADMIN_SESSION_INVALIDATED",
        }),
      );
    }

    // Attach decoded token to request for downstream use
    (req as AdminRequestWithVerifiedCreds).admin = {
      userId: decoded.userId,
      adminId: decoded.adminId,
      email: decoded.email,
      role: decoded.role as Exclude<typeof decoded.role, "USER">,
    };

    logger.debug("Admin JWT verified", {
      userId: decoded.userId,
      adminId: decoded.adminId,
      role: decoded.role,
      path: req.path,
    });

    next();
  },
);
