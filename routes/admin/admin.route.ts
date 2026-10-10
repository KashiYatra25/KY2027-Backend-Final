import {
  restProtectMiddleware,
  roleChecker,
} from "@middleware/protect/protect.route.factory.middleware.js";
import {
  verifyAdminCreds,
  refreshAdminToken,
  adminLogout,
} from "@controller/user/admin/auth/index.js";
import { makeUserAdmin } from "@controller/user/admin/invite/makeUserAdmin.controller.js";
import { getAdminUsers } from "@controller/user/admin/users/getAdminUsers.controller.js";
import {
  approveCaApplication,
  getCaApplications,
} from "@controller/user/admin/ca/index.js";
import {
  validateTargetUserForInvite,
  checkAdminDoesNotExist,
} from "@middleware/admin/invite/index.js";
import { validateUserIsAdmin } from "@middleware/admin/auth/auth.middleware.js";
import {
  verifyAdminJwtMiddleware,
  ensureAdminUserMatchesSession,
} from "@middleware/admin/jwt/verifyAdminJwt.middleware.js";
import { adminRateLimiter } from "@middleware/limiters/index.js";
import {
  adminCredVerificationSchema,
  adminInviteSchema,
} from "@schemas/admin/admin.schema.js";
import { caApprovalSchema } from "@schemas/admin/caApproval.schema.js";
import { Router, type Router as ExpressRouter } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";
import { checkUserAccountStatus } from "@middleware/protect/check.user.status.middleware.js";
import cookieParser from "cookie-parser";

export const adminRouter: ExpressRouter = Router();

// Cookie parser middleware for refresh token
adminRouter.use(cookieParser());

// ═══════════════════════════════════════════════════════════════════
// PUBLIC ADMIN AUTH ROUTES (no admin JWT required, but needs main auth)
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /admin/auth/login
 * Verify admin credentials and get JWT tokens
 * Requires: Main site authentication + valid admin role
 */
adminRouter.post(
  "/auth/login",
  restProtectMiddleware,
  checkUserAccountStatus,
  roleChecker("REST", "MASTER_ADMIN", "MANAGER", "OPERATOR"),
  adminRateLimiter,
  RequestGuardMiddleware({ body: adminCredVerificationSchema }),
  validateUserIsAdmin,
  verifyAdminCreds,
);

/**
 * POST /admin/auth/refresh
 * Refresh access token using refresh token cookie
 * No auth required - validated via refresh token
 */
adminRouter.post("/auth/refresh", refreshAdminToken);

/**
 * POST /admin/auth/logout
 * Logout and invalidate tokens
 * No auth required - just clears cookies and blacklists tokens
 */
adminRouter.post("/auth/logout", adminLogout);

// ═══════════════════════════════════════════════════════════════════
// PROTECTED ADMIN ROUTES
// Requires: NextAuth session + Admin JWT + Valid admin role
// ═══════════════════════════════════════════════════════════════════

// Apply common middleware for all protected routes below:
// 1. restProtectMiddleware - Verify NextAuth session
// 2. checkUserAccountStatus - Ensure account is active
// 3. verifyAdminJwtMiddleware - Verify Admin JWT from Authorization header
// 4. ensureAdminUserMatchesSession - JWT user matches session user
// 5. adminRateLimiter - Rate limiting
adminRouter.use(
  restProtectMiddleware,
  checkUserAccountStatus,
  verifyAdminJwtMiddleware,
  ensureAdminUserMatchesSession,
  adminRateLimiter,
);

/**
 * GET /admin/users
 * Fetch all admin users (MASTER_ADMIN sees MANAGER+OPERATOR, MANAGER sees OPERATOR)
 */
adminRouter.get(
  "/users",
  roleChecker("REST", "MASTER_ADMIN", "MANAGER"),
  getAdminUsers,
);

/**
 * GET /admin/campus-ambassador/get-applications
 * Get all CA applications (with optional status filter)
 */
adminRouter.get(
  "/campus-ambassador/get-applications",
  roleChecker("REST", "MASTER_ADMIN", "MANAGER"),
  getCaApplications,
);

/**
 * POST /admin/campus-ambassador/approve-request
 * Approve or reject a CA application
 */
adminRouter.post(
  "/campus-ambassador/approve-request",
  roleChecker("REST", "MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ body: caApprovalSchema }),
  approveCaApplication,
);

/**
 * POST /admin/convert-to-admin
 * Convert a user to admin (MANAGER or OPERATOR)
 */
adminRouter.post(
  "/convert-to-admin",
  roleChecker("REST", "MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ body: adminInviteSchema }),
  validateTargetUserForInvite,
  checkAdminDoesNotExist,
  makeUserAdmin,
);
