import type { Request, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { verifyRefreshToken } from "@controller/admin/helper/functions/index.js";
import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";
import {
  ADMIN_REFRESH_TOKEN_COOKIE_NAME,
} from "@controller/admin/constants/cookie.constants.js";
import { VALID_ADMIN_ROLES } from "@controller/admin/constants/roles.constants.js";

// ═══════════════════════════════════════════════════════════════════
// GET ADMIN SESSION
// 
// Returns:
// {
//   session: { email, role } | null,
//   userExists: boolean
// }
//
// Cases:
// 1. No JWT cookie → userExists: false, session: null
//    Frontend: "No Access" (user never had JWT)
//
// 2. JWT expired/invalid but was valid before → userExists: true, session: null
//    Frontend: Show password form (user exists, just needs to re-auth)
//
// 3. JWT valid + admin role valid → userExists: true, session: { email, role }
//    Frontend: Redirect to dashboard (already authenticated)
// ═══════════════════════════════════════════════════════════════════

export const getAdminSession = catchAsync(
  async (req: Request, res: Response) => {
    // Get refresh token from cookie
    const refreshToken = req.cookies?.[ADMIN_REFRESH_TOKEN_COOKIE_NAME];

    // ─────────────────────────────────────────────────────────────────
    // Case 1: No JWT cookie at all
    // User never had a session or cookies were cleared
    // ─────────────────────────────────────────────────────────────────
    if (!refreshToken) {
      logger.debug("getAdminSession - no refresh token cookie");
      new OkResponseStrategy().handleResponse(res, {
        info: "No session",
        session: null,
        userExists: false,
      });
      return;
    }

    // ─────────────────────────────────────────────────────────────────
    // Try to verify the refresh token
    // ─────────────────────────────────────────────────────────────────
    const decoded = verifyRefreshToken(refreshToken);

    // ─────────────────────────────────────────────────────────────────
    // Case 2: JWT exists but is expired/invalid
    // User HAD a session, but it expired - they need to re-enter password
    // ─────────────────────────────────────────────────────────────────
    if (!decoded) {
      logger.debug("getAdminSession - refresh token expired/invalid");
      new OkResponseStrategy().handleResponse(res, {
        info: "Session expired",
        session: null,
        userExists: true, // User existed (had JWT), just expired
      });
      return;
    }

    const { adminId, email } = decoded;

    // ─────────────────────────────────────────────────────────────────
    // Verify admin still exists in database
    // ─────────────────────────────────────────────────────────────────
    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      include: {
        user: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!admin) {
      logger.warn("getAdminSession - admin record not found", { adminId });
      new OkResponseStrategy().handleResponse(res, {
        info: "Admin not found",
        session: null,
        userExists: false, // Admin was deleted
      });
      return;
    }

    // Check if user still has admin role
    const userRole = admin.user?.role?.level;

    if (!userRole || !VALID_ADMIN_ROLES.includes(userRole)) {
      logger.warn("getAdminSession - user no longer has admin role", {
        adminId,
        role: userRole,
      });
      new OkResponseStrategy().handleResponse(res, {
        info: "No admin access",
        session: null,
        userExists: false, // User exists but is not admin anymore
      });
      return;
    }

    // ─────────────────────────────────────────────────────────────────
    // Case 3: Valid session - user is authenticated
    // ─────────────────────────────────────────────────────────────────
    logger.debug("getAdminSession - valid session", { adminId, email, role: userRole });

    new OkResponseStrategy().handleResponse(res, {
      info: "Session valid",
      session: {
        email,
        role: userRole,
      },
      userExists: true,
    });
  }
);
