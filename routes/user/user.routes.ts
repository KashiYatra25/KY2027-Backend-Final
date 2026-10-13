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
import { checkoutCart } from "@controller/user/cart/checkoutCart.controller.js";
import { getMyPurchases } from "@controller/user/purchases/index.js";
import { userRoutesRESTProtectMiddleware } from "@root/middleware/user/protect/index.js";
import { checkUserAccountStatusMiddleware } from "@middleware/user/protect/checkUserStatus.middleware.js";
import { blockIfProfileAlreadyCompletedMiddleware } from "@root/middleware/user/profile/checkCollegeNotAlreadyCompleted.middleware.js";
import { checkWhetherProfileIsCompleteMiddleware } from "@root/middleware/user/profile/checkWhetherProfileIsComplete.middleware.js";
import { verifyGoogleTokenMiddleware } from "@root/middleware/user/auth/index.js";
import {
  authRateLimiterMiddleware,
  contactRateLimiterMiddleware,
  searchRateLimiterMiddleware,
  referralRateLimiterMiddleware,
  profileRateLimiterMiddleware,
  cartRateLimiterMiddleware,
} from "@root/middleware/limiters/index.js";
import {
  profileUpdationRequestSchema,
  contactUsRequestSchema,
  searchUsersRequestSchema,
  addReferralIdRequestSchema,
  addToCartRequestSchema,
  removeFromCartRequestSchema,
  updateCartQuantityRequestSchema,
  checkoutCartRequestSchema,
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

// Get user's purchase history
userRouter.get("/purchases", getMyPurchases);

// Apply a CA's referral code (one-time only)
userRouter.post(
  "/apply-referral",
  referralRateLimiterMiddleware,
  RequestGuardMiddleware({ body: addReferralIdRequestSchema }),
  applyReferral,
);

userRouter.patch(
  "/profile",
  profileRateLimiterMiddleware,
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
  cartRateLimiterMiddleware,
  checkWhetherProfileIsCompleteMiddleware,
  RequestGuardMiddleware({ body: addToCartRequestSchema }),
  addToCart,
);

userRouter.patch(
  "/cart/update-quantity",
  cartRateLimiterMiddleware,
  checkWhetherProfileIsCompleteMiddleware,
  RequestGuardMiddleware({ body: updateCartQuantityRequestSchema }),
  updateCartQuantity,
);

userRouter.delete(
  "/cart/remove",
  cartRateLimiterMiddleware,
  checkWhetherProfileIsCompleteMiddleware,
  RequestGuardMiddleware({ body: removeFromCartRequestSchema }),
  removeFromCart,
);

userRouter.delete(
  "/cart/clear",
  cartRateLimiterMiddleware,
  checkWhetherProfileIsCompleteMiddleware,
  clearCart,
);

userRouter.post(
  "/cart/checkout",
  cartRateLimiterMiddleware,
  checkWhetherProfileIsCompleteMiddleware,
  RequestGuardMiddleware({ body: checkoutCartRequestSchema }),
  checkoutCart,
);