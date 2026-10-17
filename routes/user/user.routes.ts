import { authenticateUser } from "@controller/user/auth/index.js";
import { submitContact } from "@controller/user/contact/index.js";
import { searchUsers } from "@controller/user/search/searchUsers.controller.js";
import { getMyRegistrations } from "@controller/user/event/index.js";
import { getPaymentStatus } from "@controller/user/payment/getPaymentStatus.controller.js";
import { applyReferral } from "@controller/user/referral/applyReferral.controller.js";
import { getMyPurchases } from "@controller/user/purchases/index.js";
import { userRoutesRESTProtectMiddleware } from "@root/middleware/user/protect/index.js";
import { checkUserAccountStatusMiddleware } from "@middleware/user/protect/checkUserStatus.middleware.js";
import { blockIfProfileAlreadyCompletedMiddleware } from "@root/middleware/user/profile/checkCollegeNotAlreadyCompleted.middleware.js";
import { blockIfIdentityAlreadyVerifiedMiddleware } from "@root/middleware/user/profile/blockIfIdentityAlreadyVerified.middleware.js";
import { verifyGoogleTokenMiddleware } from "@root/middleware/user/auth/index.js";
import {
  authRateLimiterMiddleware,
  contactRateLimiterMiddleware,
  searchRateLimiterMiddleware,
  referralRateLimiterMiddleware,
  profileRateLimiterMiddleware,
} from "@root/middleware/limiters/index.js";
import {
  profileUpdationRequestSchema,
  contactUsRequestSchema,
  searchUsersRequestSchema,
  addReferralIdRequestSchema,
  userAuthenticationRequestSchema,
  manualIdentityVerificationSchema,
} from "@schemas/user/index.js";
import { Router, type Router as ExpressRouter } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";
import { updateProfile, submitManualIdentity } from "@controller/user/profile/index.js";

export const userRouter: ExpressRouter = Router();

// ═══════════════════════════════════════════════════════════════════
// PUBLIC ROUTES (no auth required)
// ═══════════════════════════════════════════════════════════════════

userRouter.post(
  "/auth",
  authRateLimiterMiddleware,
  RequestGuardMiddleware({ body: userAuthenticationRequestSchema }),
  verifyGoogleTokenMiddleware,
  authenticateUser,
);

userRouter.post(
  "/contact",
  contactRateLimiterMiddleware,
  RequestGuardMiddleware({ body: contactUsRequestSchema }),
  submitContact,
);

// ═══════════════════════════════════════════════════════════════════
// PROTECTED ROUTES
// All routes below require:
// 1. Valid NextAuth session (userRoutesRESTProtectMiddleware)
// 2. Active account status (checkUserAccountStatusMiddleware) - SEC-006 FIX
// ═══════════════════════════════════════════════════════════════════

userRouter.use(userRoutesRESTProtectMiddleware);
userRouter.use(checkUserAccountStatusMiddleware); // SEC-006: Block suspended users

// Search users (for team creation)
userRouter.get(
  "/search",
  searchRateLimiterMiddleware,
  RequestGuardMiddleware({ query: searchUsersRequestSchema }),
  searchUsers,
);

// Get user's event registrations
userRouter.get("/registrations", getMyRegistrations);

// Get user's payment status
userRouter.get("/payment-status", getPaymentStatus);

// Get user's purchase history (passes from KonfHub)
userRouter.get("/purchases", getMyPurchases);

// Apply a CA's referral code (one-time only)
userRouter.post(
  "/apply-referral",
  referralRateLimiterMiddleware,
  RequestGuardMiddleware({ body: addReferralIdRequestSchema }),
  applyReferral,
);

// Update profile (phone/college)
userRouter.patch(
  "/profile",
  profileRateLimiterMiddleware,
  RequestGuardMiddleware({ body: profileUpdationRequestSchema }),
  blockIfProfileAlreadyCompletedMiddleware,
  updateProfile,
);

// Manual identity verification (alternative to Aadhaar)
userRouter.post(
  "/profile/manual-identity",
  profileRateLimiterMiddleware,
  RequestGuardMiddleware({ body: manualIdentityVerificationSchema }),
  blockIfIdentityAlreadyVerifiedMiddleware,
  submitManualIdentity,
);

// ═══════════════════════════════════════════════════════════════════
// TICKETING
// Pass purchases are now handled by KonfHub - we receive webhooks
// See /webhooks/konfhub route in payment.routes.ts
// ═══════════════════════════════════════════════════════════════════
