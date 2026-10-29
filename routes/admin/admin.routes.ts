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
import { getPartners } from "@controller/admin/partner/getPartners.controller.js";
import { changeAccountStatus } from "@controller/admin/suspend/changeAccountStatus.controller.js";
import { makeUserAdminOrPromoteAdmin } from "@controller/admin/promote/makeUserAdminOrPromoteAdmin.controller.js";
import { changeAdminRole } from "@controller/admin/promote/changeAdminRole.controller.js";
import { demoteAdminToUser } from "@controller/admin/promote/demoteAdminToUser.controller.js";
import { getAdminUsers } from "@controller/admin/users/getAdminUsers.controller.js";
import { getAllUsers } from "@controller/admin/users/getAllUsers.controller.js";
import { toggleUserPaidStatus } from "@controller/admin/user/toggleUserPaidStatus.controller.js";
import { getAllTeams } from "@controller/admin/teams/getAllTeams.controller.js";
import { getAllRegistrations } from "@controller/admin/registrations/getAllRegistrations.controller.js";
import { getRevenueAnalytics } from "@controller/admin/purchases/index.js";
import { invalidateAllCaches } from "@controller/admin/cache/invalidateAllCaches.controller.js";
import { invalidateUserCache } from "@controller/admin/cache/invalidateUserCache.controller.js";
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
import { adminRateLimiterMiddleware } from "@middleware/limiters/index.js";
import { adminRoutesRESTProtectMiddleware } from "@middleware/admin/protect/adminRoutesRESTProtect.middleware.js";
import { checkAdminAccountStatusMiddleware } from "@middleware/admin/protect/checkAdminAccountStatus.middleware.js";
import { adminRoleCheckerMiddleware } from "@middleware/admin/protect/adminRoleChecker.middleware.js";
import {
  adminOnboardingRequestSchema,
  adminLoginRequestSchema,
  adminAccountStatusChangeRequestSchema,
  promoteUserOrAdminRoleRequestSchema,
  changeAdminRoleRequestSchema,
  demoteAdminToUserRequestSchema,
  getTeamsQuerySchema,
  getRegistrationsQuerySchema,
} from "@schemas/admin/admin.schema.js";
import {
  forgotPasswordRequestSchema,
  resetPasswordRequestSchema,
} from "@schemas/admin/forgotPassword.schema.js";
import { changePasswordRequestSchema } from "@schemas/admin/changePassword.schema.js";
import { caApplicationApprovalRequestSchema } from "@schemas/admin/caApproval.schema.js";
import { caApplicationStatusUpdateRequestSchema } from "@schemas/admin/caStatusUpdate.schema.js";
import {
  createVenueRequestSchema,
  updateVenueRequestSchema,
  venueIdParamRequestSchema,
  createFestDayRequestSchema,
  updateFestDayRequestSchema,
  festDayIdParamRequestSchema,
  createScheduleEntryRequestSchema,
  updateScheduleEntryRequestSchema,
  scheduleEntryIdParamRequestSchema,
  bulkCreateVenuesRequestSchema,
  bulkCreateFestDaysRequestSchema,
  bulkCreateScheduleEntriesRequestSchema,
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
  adminRateLimiterMiddleware,
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
adminRouter.post(
  "/refresh-token",
  adminRateLimiterMiddleware,
  refreshAdminToken,
);

/**
 * POST /confirm-onboarding
 * First-time admin onboarding - set password after receiving invite
 * Requires valid onboarding token (from email link)
 */
adminRouter.post(
  "/confirm-onboarding",
  adminRateLimiterMiddleware,
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
  adminRateLimiterMiddleware,
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
  adminRateLimiterMiddleware,
  RequestGuardMiddleware({ body: resetPasswordRequestSchema }),
  resetPassword,
);

// ═══════════════════════════════════════════════════════════════════
// PROTECTED ROUTES (admin JWT required + not suspended)
// ═══════════════════════════════════════════════════════════════════

adminRouter.use(
  adminRateLimiterMiddleware,
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
 * Requires: MASTER_ADMIN, MANAGER, or OPERATOR role
 */
adminRouter.get(
  "/get-all-users",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER", "OPERATOR"),
  getAllUsers,
);

/**
 * POST /toggle-user-paid-status
 * Toggle a user's isPaidUser status (true <-> false)
 * Body: { userId: string }
 * Requires: MASTER_ADMIN role only
 */
adminRouter.post(
  "/toggle-user-paid-status",
  adminRoleCheckerMiddleware("MASTER_ADMIN"),
  toggleUserPaidStatus,
);

/**
 * POST /change-account-status
 * Suspend or reactivate a user or admin account
 * Body: { targetEmail, action: "SUSPEND" | "REACTIVATE", reason? }
 * Hierarchy:
 * - MASTER_ADMIN can change: MANAGER, OPERATOR, USER
 * - MANAGER can change: OPERATOR, USER
 * Requires: MASTER_ADMIN or MANAGER role
 */
adminRouter.post(
  "/change-account-status",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ body: adminAccountStatusChangeRequestSchema }),
  changeAccountStatus,
);

/**
 * POST /convert-to-admin
 * Promote a regular user to admin role
 * Body: { targetEmail, role: "MANAGER" | "OPERATOR" }
 * Only IIT BHU users can be promoted.
 * Hierarchy:
 * - MASTER_ADMIN can promote to: MANAGER, OPERATOR
 * - MANAGER can promote to: OPERATOR only
 * Requires: MASTER_ADMIN or MANAGER role
 */
adminRouter.post(
  "/convert-to-admin",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ body: promoteUserOrAdminRoleRequestSchema }),
  makeUserAdminOrPromoteAdmin,
);

/**
 * POST /change-admin-role
 * Change an existing admin's role (promote/demote)
 * Body: { targetEmail, newRole: "MANAGER" | "OPERATOR" }
 * Valid transitions: MANAGER ↔ OPERATOR
 * Cannot change MASTER_ADMIN's role or your own role
 * Requires: MASTER_ADMIN role only
 */
adminRouter.post(
  "/change-admin-role",
  adminRoleCheckerMiddleware("MASTER_ADMIN"),
  RequestGuardMiddleware({ body: changeAdminRoleRequestSchema }),
  changeAdminRole,
);

/**
 * POST /demote-admin-to-user
 * Completely remove admin privileges and revert to regular user
 * Body: { targetEmail }
 * Deletes Admin record and changes role to USER
 * Cannot demote MASTER_ADMIN or yourself
 * Requires: MASTER_ADMIN role only
 */
adminRouter.post(
  "/demote-admin-to-user",
  adminRoleCheckerMiddleware("MASTER_ADMIN"),
  RequestGuardMiddleware({ body: demoteAdminToUserRequestSchema }),
  demoteAdminToUser,
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
  RequestGuardMiddleware({ body: caApplicationStatusUpdateRequestSchema }),
  updateCaApplicationStatus,
);

// ═══════════════════════════════════════════════════════════════════
// TEAM MANAGEMENT ROUTES
// Requires: MASTER_ADMIN or MANAGER role
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /admin/teams
 * Get all teams with member details (paginated)
 * Query params: page, limit, search
 */
adminRouter.get(
  "/teams",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ query: getTeamsQuerySchema }),
  getAllTeams,
);

// ═══════════════════════════════════════════════════════════════════
// EVENT REGISTRATION MANAGEMENT ROUTES
// Requires: MASTER_ADMIN or MANAGER role
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /admin/registrations
 * Get all event registrations with details (paginated)
 * Query params: page, limit, eventSlug, status, participationType
 */
adminRouter.get(
  "/registrations",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ query: getRegistrationsQuerySchema }),
  getAllRegistrations,
);

// ═══════════════════════════════════════════════════════════════════
// PAYMENTS & REVENUE ANALYTICS
// Requires: MASTER_ADMIN or MANAGER role
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /admin/revenue
 * Revenue analytics: totals, date-wise trend, and pass-wise breakdown.
 * Query params: days (trend window, default 30, max 365)
 */
adminRouter.get(
  "/revenue",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  getRevenueAnalytics,
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
  RequestGuardMiddleware({ params: venueIdParamRequestSchema }),
  getVenueByIdAdmin,
);

adminRouter.post(
  "/schedule/venues",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ body: createVenueRequestSchema }),
  createVenue,
);

adminRouter.post(
  "/schedule/venues/bulk",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ body: bulkCreateVenuesRequestSchema }),
  bulkCreateVenues,
);

adminRouter.patch(
  "/schedule/venues/:venueId",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ params: venueIdParamRequestSchema, body: updateVenueRequestSchema }),
  updateVenue,
);

adminRouter.delete(
  "/schedule/venues/:venueId",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ params: venueIdParamRequestSchema }),
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
  RequestGuardMiddleware({ params: festDayIdParamRequestSchema }),
  getFestDayByIdAdmin,
);

adminRouter.post(
  "/schedule/fest-days",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ body: createFestDayRequestSchema }),
  createFestDay,
);

adminRouter.post(
  "/schedule/fest-days/bulk",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ body: bulkCreateFestDaysRequestSchema }),
  bulkCreateFestDays,
);

adminRouter.patch(
  "/schedule/fest-days/:festDayId",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ params: festDayIdParamRequestSchema, body: updateFestDayRequestSchema }),
  updateFestDay,
);

adminRouter.delete(
  "/schedule/fest-days/:festDayId",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ params: festDayIdParamRequestSchema }),
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
  RequestGuardMiddleware({ params: scheduleEntryIdParamRequestSchema }),
  getScheduleEntryByIdAdmin,
);

adminRouter.post(
  "/schedule/entries",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ body: createScheduleEntryRequestSchema }),
  createScheduleEntry,
);

adminRouter.post(
  "/schedule/entries/bulk",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ body: bulkCreateScheduleEntriesRequestSchema }),
  bulkCreateScheduleEntries,
);

adminRouter.patch(
  "/schedule/entries/:scheduleEntryId",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ params: scheduleEntryIdParamRequestSchema, body: updateScheduleEntryRequestSchema }),
  updateScheduleEntry,
);

adminRouter.delete(
  "/schedule/entries/:scheduleEntryId",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  RequestGuardMiddleware({ params: scheduleEntryIdParamRequestSchema }),
  deleteScheduleEntry,
);

// ═══════════════════════════════════════════════════════════════════
// PARTNER (SPONSORSHIP INQUIRY) ROUTES
// Requires: MASTER_ADMIN or MANAGER role
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /admin/partners
 * List all partnership inquiries submitted via the "Partner With Us" form.
 */
adminRouter.get(
  "/partners",
  adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
  getPartners,
);

// ═══════════════════════════════════════════════════════════════════
// CACHE MANAGEMENT ROUTES
// Requires: MASTER_ADMIN only (dangerous operation)
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /admin/cache/invalidate
 * Invalidate all application caches (schedule, events, passes, per-user caches).
 * Does NOT flush rate-limit state, OTP state, or admin tokens.
 */
adminRouter.post(
  "/cache/invalidate",
  adminRoleCheckerMiddleware("MASTER_ADMIN"),
  invalidateAllCaches,
);

/**
 * POST /admin/cache/invalidate-user
 * Invalidate all cached data for a specific user.
 * Body: { userId: string }
 */
adminRouter.post(
  "/cache/invalidate-user",
  adminRoleCheckerMiddleware("MASTER_ADMIN"),
  invalidateUserCache,
);

