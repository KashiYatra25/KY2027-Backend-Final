import type { NextFunction, Response, Request } from "express";
import { catchAsync } from "zodex-axon/core";
import { UnauthorizedAccess, ForbiddenErrorResponse } from "zodex-axon/errors";
import { logger } from "@logger/index.js";
import { AdminJwtService, type DecodedAdminToken } from "@services/admin/jwt.service.js";
import { redisService } from "@services/redis/index.js";
import { getAdminRefreshTokenKey } from "@services/redis/keys/redis.keys.js";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface AdminJwtVerifiedRequest extends Request {
  adminToken: DecodedAdminToken;
}

// ═══════════════════════════════════════════════════════════════════
// ADMIN JWT VERIFICATION MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════

/**
 * Middleware to verify admin JWT access token from Authorization header.
 * 
 * This is SEPARATE from restProtectMiddleware (NextAuth session).
 * Admin routes require BOTH:
 * 1. Valid NextAuth session (restProtectMiddleware)
 * 2. Valid Admin JWT (this middleware)
 * 
 * This provides step-up authentication for admin operations.
 */
export const verifyAdminJwtMiddleware = catchAsync(
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.warn("Admin JWT missing or malformed", { 
        path: req.path,
        hasHeader: !!authHeader 
      });
      return next(
        new UnauthorizedAccess().handleResponse(res, {
          info: "Admin authentication required. Please login to the admin panel.",
          code: "ADMIN_TOKEN_MISSING",
        }),
      );
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix

    // Verify the access token
    const decoded = AdminJwtService.verifyAccessToken(token);

    if (!decoded) {
      logger.warn("Admin JWT verification failed", { 
        path: req.path,
        tokenPreview: token.slice(0, 20) + "..." 
      });
      return next(
        new UnauthorizedAccess().handleResponse(res, {
          info: "Invalid or expired admin token. Please login again.",
          code: "ADMIN_TOKEN_INVALID",
        }),
      );
    }

    // Check if the corresponding refresh token JTI is still valid in Redis
    // This ensures the session hasn't been invalidated (logout/revoked)
    const refreshJti = decoded.jti?.replace("access_", "refresh_");
    if (refreshJti) {
      const storedJti = await redisService.redisConnection!.get(
        getAdminRefreshTokenKey(decoded.userId)
      );
      
      // If no stored JTI or mismatch, the session was invalidated
      if (!storedJti || storedJti !== refreshJti) {
        logger.warn("Admin session invalidated - JTI mismatch", {
          userId: decoded.userId,
          path: req.path,
        });
        return next(
          new ForbiddenErrorResponse().handleResponse(res, {
            info: "Admin session has been invalidated. Please login again.",
            code: "ADMIN_SESSION_INVALIDATED",
          }),
        );
      }
    }

    // Attach decoded token to request for downstream use
    (req as AdminJwtVerifiedRequest).adminToken = decoded;

    logger.debug("Admin JWT verified", {
      userId: decoded.userId,
      adminId: decoded.adminId,
      role: decoded.role,
      path: req.path,
    });

    next();
  },
);

/**
 * Optional: Verify that the admin JWT user matches the NextAuth session user.
 * Use this after both restProtectMiddleware and verifyAdminJwtMiddleware.
 */
export const ensureAdminUserMatchesSession = catchAsync(
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const adminToken = (req as AdminJwtVerifiedRequest).adminToken;
    const sessionUser = (req as any).user; // From restProtectMiddleware

    if (!adminToken || !sessionUser) {
      return next(
        new UnauthorizedAccess().handleResponse(res, {
          info: "Authentication context missing.",
        }),
      );
    }

    if (adminToken.userId !== sessionUser.id) {
      logger.warn("Admin JWT user doesn't match session user", {
        jwtUserId: adminToken.userId,
        sessionUserId: sessionUser.id,
        path: req.path,
      });
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: "Admin token doesn't match current session. Please login again.",
          code: "ADMIN_USER_MISMATCH",
        }),
      );
    }

    next();
  },
);
