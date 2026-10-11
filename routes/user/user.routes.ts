import { authenticateUser } from "@controller/user/auth/index.js";
import { submitContact } from "@controller/user/contact/index.js";
import { searchUsers } from "@controller/user/search/searchUsers.controller.js";
import { getMyRegistrations } from "@controller/user/event/index.js";
import { getPaymentStatus } from "@controller/user/payment/getPaymentStatus.controller.js";
import { applyReferral } from "@controller/user/referral/applyReferral.controller.js";
import { getCart } from "@controller/user/cart/getCart.controller.js";
import { addToCart } from "@controller/user/cart/addToCart.controller.js";
import { removeFromCart } from "@controller/user/cart/removeFromCart.controller.js";
import { clearCart } from "@controller/user/cart/clearCart.controller.js";
import { updateCartQuantity } from "@controller/user/cart/updateCartQuantity.controller.js";
import { userRoutesRESTProtectMiddleware } from "@root/middleware/user/protect/index.js";
import { checkUserAccountStatusMiddleware } from "@root/middleware/user/protect/check.user.status.middleware.js";
import { blockIfProfileAlreadyCompletedMiddleware } from "@root/middleware/user/profile/checkCollegeNotAlreadyCompleted.middleware.js";
import { checkWhetherProfileIsCompleteMiddleware } from "@root/middleware/user/profile/checkWhetherProfileIsComplete.middleware.js";
import { verifyGoogleTokenMiddleware } from "@root/middleware/user/auth/index.js";
import {
  authRateLimiter,
  contactRateLimiter,
  searchRateLimiter,
  referralRateLimiter,
  profileRateLimiter,
  cartRateLimiter,
} from "@root/middleware/limiters/index.js";
import {
  profileUpdationRequestSchema,
  contactUsRequestSchema,
  searchUsersRequestSchema,
  addReferralIdRequestSchema,
  addToCartRequestSchema,
  removeFromCartRequestSchema,
  updateCartQuantityRequestSchema,
  userAuthenticationRequestSchema,
} from "@schemas/user/index.js";
import { Router, type Router as ExpressRouter } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";
import { updateProfile } from "@controller/user/profile/index.js";

export const userRouter: ExpressRouter = Router();

// ═══════════════════════════════════════════════════════════════════
// PUBLIC ROUTES (no auth required)
// ═══════════════════════════════════════════════════════════════════

userRouter.post(
  "/auth",
  authRateLimiter,
  RequestGuardMiddleware({ body: userAuthenticationRequestSchema }),
  verifyGoogleTokenMiddleware,
  authenticateUser,
);

userRouter.post(
  "/contact",
  contactRateLimiter,
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
  searchRateLimiter,
  RequestGuardMiddleware({ query: searchUsersRequestSchema }),
  searchUsers,
);

// Get user's event registrations
userRouter.get("/registrations", getMyRegistrations);

// Get user's payment status
userRouter.get("/payment-status", getPaymentStatus);

// Apply a CA's referral code (one-time only)
userRouter.post(
  "/apply-referral",
  referralRateLimiter,
  RequestGuardMiddleware({ body: addReferralIdRequestSchema }),
  applyReferral,
);

userRouter.patch(
  "/profile",
  profileRateLimiter,
  RequestGuardMiddleware({ body: profileUpdationRequestSchema }),
  blockIfProfileAlreadyCompletedMiddleware,
  updateProfile,
);

// ═══════════════════════════════════════════════════════════════════
// CART ROUTES
// Additional requirement: Profile must be complete
// ═══════════════════════════════════════════════════════════════════

userRouter.get("/cart", checkWhetherProfileIsCompleteMiddleware, getCart);

userRouter.post(
  "/cart/add",
  cartRateLimiter,
  checkWhetherProfileIsCompleteMiddleware,
  RequestGuardMiddleware({ body: addToCartRequestSchema }),
  addToCart,
);

userRouter.patch(
  "/cart/update-quantity",
  cartRateLimiter,
  checkWhetherProfileIsCompleteMiddleware,
  RequestGuardMiddleware({ body: updateCartQuantityRequestSchema }),
  updateCartQuantity,
);

userRouter.delete(
  "/cart/remove",
  cartRateLimiter,
  checkWhetherProfileIsCompleteMiddleware,
  RequestGuardMiddleware({ body: removeFromCartRequestSchema }),
  removeFromCart,
);

userRouter.delete(
  "/cart/clear",
  cartRateLimiter,
  checkWhetherProfileIsCompleteMiddleware,
  clearCart,
);
