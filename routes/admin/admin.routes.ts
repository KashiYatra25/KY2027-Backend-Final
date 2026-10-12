import {
  confirmAdminOnboarding,
  adminLogout,
  getAdminSession,
  adminLogin,
  refreshAdminToken,
  forgotPassword,
  resetPassword,
  changePassword,
} from "@controller/admin/auth/index.js";
import { approveCaApplication } from "@controller/admin/ca/approveCaApplication.controller.js";
import { getCaApplications } from "@controller/admin/ca/getCaApplications.controller.js";
import { updateCaApplicationStatus } from "@controller/admin/ca/updateCaApplicationStatus.controller.js";
import { getAdminUsers } from "@controller/admin/users/getAdminUsers.controller.js";
import { getAllUsers } from "@controller/admin/users/getAllUsers.controller.js";
import {
  getVenuesAdmin,
  getVenueByIdAdmin,
  createVenue,
  updateVenue,
  deleteVenue,
  bulkCreateVenues,
  getFestDaysAdmin,
  getFestDayByIdAdmin,
  createFestDay,
  updateFestDay,
  deleteFestDay,
  bulkCreateFestDays,
  getScheduleEntriesAdmin,
  getScheduleEntryByIdAdmin,
  createScheduleEntry,
  updateScheduleEntry,
  deleteScheduleEntry,
  bulkCreateScheduleEntries,
} from "@controller/admin/schedule/index.js";
import { adminRateLimiter } from "@middleware/limiters/index.js";
import { adminRoutesRESTProtectMiddleware } from "@middleware/admin/protect/adminRoutesRESTProtect.middleware.js";
import { checkAdminAccountStatusMiddleware } from "@middleware/admin/protect/checkAdminAccountStatus.middleware.js";
import { adminRoleCheckerMiddleware } from "@middleware/admin/protect/adminRoleChecker.middleware.js";
import {
  adminOnboardingRequestSchema,
  adminLoginRequestSchema,
} from "@schemas/admin/admin.schema.js";
import {
  forgotPasswordRequestSchema,
  resetPasswordRequestSchema,
} from "@schemas/admin/forgotPassword.schema.js";
import { changePasswordRequestSchema } from "@schemas/admin/changePassword.schema.js";
import { caApplicationApprovalRequestSchema } from "@schemas/admin/caApproval.schema.js";
import { caApplicationStatusUpdateSchema } from "@schemas/admin/caStatusUpdate.schema.js";
import {
  createVenueSchema,
  updateVenueSchema,
  venueIdParamSchema,
  createFestDaySchema,
  updateFestDaySchema,
  festDayIdParamSchema,
  createScheduleEntrySchema,
  updateScheduleEntrySchema,
  scheduleEntryIdParamSchema,
  bulkCreateVenuesSchema,
  bulkCreateFestDaysSchema,
  bulkCreateScheduleEntriesSchema,
} from "@schemas/admin/schedule.schema.js";
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
  RequestGuardMiddleware({ body: adminLoginRequestSchema }),
  adminLogin,
);

/**
 * POST /logout
 * Logout - clears refresh token cookie
 */
adminRouter.post("/logout", adminLogout);

/**
 * POST /refresh-token
 * Refresh access token using HttpOnly refresh token cookie
 * Returns: { accessToken, accessTokenExpiry }
 */
adminRouter.post("/refresh-token", refreshAdminToken);

/**
 * POST /confirm-onboarding
 * First-time admin onboarding - set password after receiving invite
 * Requires valid onboarding token (from email link)
 */
adminRouter.post(
  "/confirm-onboarding",
  adminRateLimiter,
  RequestGuardMiddleware({ body: adminOnboardingRequestSchema }),
  confirmAdminOnboarding,
);

/**
 * POST /forgot-password
 * Request password reset link
 * Sends email with reset token (10 min expiry)
 */
adminRouter.post(
  "/forgot-password",
  adminRateLimiter,
  RequestGuardMiddleware({ body: forgotPasswordRequestSchema }),
  forgotPassword,
);

/**
 * POST /reset-password
 * Reset password using token from email
 * Requires valid token, email, and new password
 */
adminRouter.post(
  "/reset-password",
  adminRateLimiter,
  RequestGuardMiddleware({ body: resetPasswordRequestSchema }),
  resetPassword,
);

// ═══════════════════════════════════════════════════════════════════
// PROTECTED ROUTES (admin JWT required + not suspended)
// ═══════════════════════════════════════════════════════════════════

adminRouter.use(
  adminRateLimiter,
  adminRoutesRESTProtectMiddleware,
  checkAdminAccountStatusMiddleware,
);

/**
 * POST /change-password
 * Change password for authenticated admin
 * Requires: current password verification
 */
adminRouter.post(
  "/change-password",
  RequestGuardMiddleware({ body: changePasswordRequestSchema }),
  changePassword,
);

/**
 * GET /get-admin-users
 * Get list of admin users (filtered by requester's role)
 * Requires: MASTER_ADMIN or MANAGER role
 */
adminRouter.get(
  "/get-admin-users",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  getAdminUsers,
);

/**
 * GET /get-all-users
 * Get paginated list of all regular users (role: USER)
 * Query params: page, limit (max 50), search
 * Requires: MASTER_ADMIN or MANAGER role
 */
adminRouter.get(
  "/get-all-users",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  getAllUsers,
);

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

/**
 * PATCH /campus-ambassador/update-status
 * Change status of an already-processed CA application
 * Valid transitions: ACCEPTED ↔ REJECTED
 * Cannot be used for PENDING applications (use approve-request instead)
 * Requires: MASTER_ADMIN or MANAGER role
 */
adminRouter.patch(
  "/campus-ambassador/update-status",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ body: caApplicationStatusUpdateSchema }),
  updateCaApplicationStatus,
);

// ═══════════════════════════════════════════════════════════════════
// SCHEDULE MANAGEMENT ROUTES
// Requires: MASTER_ADMIN or MANAGER role
// ═══════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────
// VENUES
// ─────────────────────────────────────────────────────────────────────

adminRouter.get(
  "/schedule/venues",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  getVenuesAdmin,
);

adminRouter.get(
  "/schedule/venues/:venueId",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ params: venueIdParamSchema }),
  getVenueByIdAdmin,
);

adminRouter.post(
  "/schedule/venues",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ body: createVenueSchema }),
  createVenue,
);

adminRouter.post(
  "/schedule/venues/bulk",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ body: bulkCreateVenuesSchema }),
  bulkCreateVenues,
);

adminRouter.patch(
  "/schedule/venues/:venueId",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ params: venueIdParamSchema, body: updateVenueSchema }),
  updateVenue,
);

adminRouter.delete(
  "/schedule/venues/:venueId",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ params: venueIdParamSchema }),
  deleteVenue,
);

// ─────────────────────────────────────────────────────────────────────
// FEST DAYS
// ─────────────────────────────────────────────────────────────────────

adminRouter.get(
  "/schedule/fest-days",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  getFestDaysAdmin,
);

adminRouter.get(
  "/schedule/fest-days/:festDayId",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ params: festDayIdParamSchema }),
  getFestDayByIdAdmin,
);

adminRouter.post(
  "/schedule/fest-days",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ body: createFestDaySchema }),
  createFestDay,
);

adminRouter.post(
  "/schedule/fest-days/bulk",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ body: bulkCreateFestDaysSchema }),
  bulkCreateFestDays,
);

adminRouter.patch(
  "/schedule/fest-days/:festDayId",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ params: festDayIdParamSchema, body: updateFestDaySchema }),
  updateFestDay,
);

adminRouter.delete(
  "/schedule/fest-days/:festDayId",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ params: festDayIdParamSchema }),
  deleteFestDay,
);

// ─────────────────────────────────────────────────────────────────────
// SCHEDULE ENTRIES
// ─────────────────────────────────────────────────────────────────────

adminRouter.get(
  "/schedule/entries",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  getScheduleEntriesAdmin,
);

adminRouter.get(
  "/schedule/entries/:scheduleEntryId",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ params: scheduleEntryIdParamSchema }),
  getScheduleEntryByIdAdmin,
);

adminRouter.post(
  "/schedule/entries",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ body: createScheduleEntrySchema }),
  createScheduleEntry,
);

adminRouter.post(
  "/schedule/entries/bulk",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ body: bulkCreateScheduleEntriesSchema }),
  bulkCreateScheduleEntries,
);

adminRouter.patch(
  "/schedule/entries/:scheduleEntryId",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ params: scheduleEntryIdParamSchema, body: updateScheduleEntrySchema }),
  updateScheduleEntry,
);

adminRouter.delete(
  "/schedule/entries/:scheduleEntryId",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ params: scheduleEntryIdParamSchema }),
  deleteScheduleEntry,
);
