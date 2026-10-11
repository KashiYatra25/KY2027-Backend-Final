import {
  confirmAdminOnboarding,
  adminLogout,
  getAdminSession,
  adminLogin,
} from "@controller/admin/auth/index.js";
import { approveCaApplication } from "@controller/admin/ca/approveCaApplication.controller.js";
import { getCaApplications } from "@controller/admin/ca/getCaApplications.controller.js";
import { adminRoutesRESTProtectMiddleware } from "@middleware/admin/protect/adminRoutesRESTProtect.middleware.js";
import { roleCheckerMiddleware } from "@middleware/user/protect/index.js";
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
 */
adminRouter.post(
  "/login",
  adminRateLimiter,
  roleCheckerMiddleware("REST" , "MASTER_ADMIN" , "MANAGER" , "OPERATOR"),
  RequestGuardMiddleware({ body: adminLoginRequestSchema }),
  adminLogin,
);

/**
 * POST /logout
 * Logout and invalidate tokens
 * Clears cookies and blacklists tokens
 */
adminRouter.post("/logout", roleCheckerMiddleware("REST" , "MASTER_ADMIN" , "MANAGER" , "OPERATOR"), adminLogout);

/**
 * POST /confirm-onboarding
 * First-time admin onboarding - set password after receiving invite
 * Requires valid onboarding token
 */
adminRouter.post(
  "/confirm-onboarding",
  adminRateLimiter,
  roleCheckerMiddleware("REST" , "MASTER_ADMIN" , "MANAGER" , "OPERATOR"),
  RequestGuardMiddleware({ body: adminOnboardingRequestSchema }),
  confirmAdminOnboarding,
);

// ═══════════════════════════════════════════════════════════════════
// PROTECTED ROUTES (admin JWT required)
// ═══════════════════════════════════════════════════════════════════

// All routes below require valid admin JWT
adminRouter.use(adminRateLimiter , adminRoutesRESTProtectMiddleware);

/**
 * GET /campus-ambassador/get-applications
 * Get all CA applications (with optional status filter)
 * Requires: MASTER_ADMIN or MANAGER role
 */
adminRouter.get(
  "/campus-ambassador/get-applications",
  roleCheckerMiddleware("REST", "MASTER_ADMIN", "MANAGER"),
  getCaApplications,
);

/**
 * POST /campus-ambassador/approve-request
 * Approve or reject a CA application
 * Requires: MASTER_ADMIN or MANAGER role
 */
adminRouter.post(
  "/campus-ambassador/approve-request",
  roleCheckerMiddleware("REST", "MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ body: caApplicationApprovalRequestSchema }),
  approveCaApplication,
);

/**
 * POST /role-change
 * Change user role (promote/demote)
 * Requires: MASTER_ADMIN or MANAGER role
 * TODO: Implement controller
 */
// adminRouter.post(
//   "/role-change",
//   roleCheckerMiddleware("REST", "MASTER_ADMIN", "MANAGER"),
//   RequestGuardMiddleware({ body: roleChangeRequestSchema }),
//   changeUserRole,
// );
