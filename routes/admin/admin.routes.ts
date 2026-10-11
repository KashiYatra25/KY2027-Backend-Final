import {
  confirmAdminOnboarding,
  adminLogout,
  getAdminSession,
  adminLogin,
  refreshAdminToken,
} from "@controller/admin/auth/index.js";
import { approveCaApplication } from "@controller/admin/ca/approveCaApplication.controller.js";
import { getCaApplications } from "@controller/admin/ca/getCaApplications.controller.js";
import {
  adminRoutesRESTProtectMiddleware,
  adminRoleCheckerMiddleware,
} from "@middleware/admin/protect/index.js";
import { adminRateLimiter } from "@middleware/limiters/index.js";
import {
  adminOnboardingRequestSchema,
  adminLoginRequestSchema,
} from "@schemas/admin/admin.schema.js";
import { caApplicationApprovalRequestSchema } from "@schemas/admin/caApproval.schema.js";
import { Router, type Router as ExpressRouter } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";

export const adminRouter: ExpressRouter = Router();

// ═══════════════════════════════════════════════════════════════════
// PUBLIC ROUTES (no admin JWT required)
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /get-session
 * Get current admin session status from refresh token cookie
 * Returns: { session: {email, role} | null, userExists: boolean }
 */
adminRouter.get("/get-session", getAdminSession);

/**
 * POST /login
 * Admin login with email + password
 * Issues JWT tokens (access + refresh)
 * 
 * NOTE: No role checker here - this is standalone login.
 * The controller itself validates the user has admin role.
 */
adminRouter.post(
  "/login",
  adminRateLimiter,
  RequestGuardMiddleware({ body: adminLoginRequestSchema }),
  adminLogin,
);

/**
 * POST /logout
 * Logout - clears refresh token cookie
 * No auth required - just clears cookie if it exists
 */
adminRouter.post("/logout", adminLogout);

/**
 * POST /refresh-token
 * Refresh access token using HttpOnly refresh token cookie
 * Returns: { accessToken, accessTokenExpiry }
 * 
 * Uses refresh token rotation for security.
 */
adminRouter.post("/refresh-token", refreshAdminToken);

/**
 * POST /confirm-onboarding
 * First-time admin onboarding - set password after receiving invite
 * Requires valid onboarding token (from email link)
 * 
 * NOTE: No role checker here - this is standalone.
 * The controller validates the user via the token.
 */
adminRouter.post(
  "/confirm-onboarding",
  adminRateLimiter,
  RequestGuardMiddleware({ body: adminOnboardingRequestSchema }),
  confirmAdminOnboarding,
);

// ═══════════════════════════════════════════════════════════════════
// PROTECTED ROUTES (admin JWT required)
// ═══════════════════════════════════════════════════════════════════

// All routes below require valid admin JWT
adminRouter.use(adminRateLimiter, adminRoutesRESTProtectMiddleware);

/**
 * GET /campus-ambassador/get-applications
 * Get all CA applications (with optional status filter)
 * Requires: MASTER_ADMIN or MANAGER role
 */
adminRouter.get(
  "/campus-ambassador/get-applications",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  getCaApplications,
);

/**
 * POST /campus-ambassador/approve-request
 * Approve or reject a CA application
 * Requires: MASTER_ADMIN or MANAGER role
 */
adminRouter.post(
  "/campus-ambassador/approve-request",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ body: caApplicationApprovalRequestSchema }),
  approveCaApplication,
);
