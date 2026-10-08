import { authenticateUser } from "@controller/user/auth/index.js";
import { updateProfile } from "@controller/user/profile/index.js";
import { submitContact } from "@controller/user/contact/index.js";
import { searchUsers } from "@controller/user/search/index.js";
import { getMyRegistrations } from "@controller/user/event/index.js";
import { getPaymentStatus } from "@controller/user/payment/index.js";
import { applyReferral } from "@controller/user/referral/applyReferral.controller.js";
import { getCart } from "@controller/user/cart/getCart.controller.js";
import { addToCart } from "@controller/user/cart/addToCart.controller.js";
import { removeFromCart } from "@controller/user/cart/removeFromCart.controller.js";
import { clearCart } from "@controller/user/cart/clearCart.controller.js";
import { restProtectMiddleware, roleChecker } from "@middleware/protect/protect.route.factory.middleware.js";
import { blockIfProfileAlreadyCompleted } from "@middleware/user/profile/checkCollegeNotAlreadyCompleted.middleware.js";
import { checkWhetherProfileIsCompleteMiddleware } from "@middleware/user/profile/checkWhetherProfileIsComplete.middleware.js";
import { profileUpdationSchema } from "@schemas/user/profile.schema.js";
import { contactSchema } from "@schemas/user/contact.schema.js";
import { searchUsersQuerySchema } from "@schemas/user/search.schema.js";
import { applyReferralSchema } from "@schemas/user/referral.schema.js";
import { addToCartSchema, removeFromCartSchema } from "@schemas/user/cart.schema.js";
import { Router, type Router as ExpressRouter } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";
import { userAuthSchema } from "@schemas/user/user.auth.schema.js";

export const userRouter: ExpressRouter = Router();

userRouter.post(
  "/auth",
  RequestGuardMiddleware({ body: userAuthSchema }),
  authenticateUser,
);

// Public endpoint - no auth required
userRouter.post(
  "/contact",
  RequestGuardMiddleware({ body: contactSchema }),
  submitContact,
);

userRouter.use(restProtectMiddleware);

// Search users (for team creation)
userRouter.get(
  "/search",
  RequestGuardMiddleware({ query: searchUsersQuerySchema }),
  searchUsers,
);

// Get user's event registrations
userRouter.get("/registrations", getMyRegistrations);

// Get user's payment status
userRouter.get("/payment-status", getPaymentStatus);

// Apply a CA's referral code (one-time only)
userRouter.post(
  "/apply-referral",
  RequestGuardMiddleware({ body: applyReferralSchema }),
  applyReferral,
);

userRouter.patch(
  "/profile",
  RequestGuardMiddleware({ body: profileUpdationSchema }),
  blockIfProfileAlreadyCompleted,
  updateProfile,
);

// ═══════════════════════════════════════════════════════════════════
// CART ROUTES
// Only for: Authenticated + Profile Complete + USER role + Non-IIT BHU users
// ═══════════════════════════════════════════════════════════════════

userRouter.get("/cart", checkWhetherProfileIsCompleteMiddleware, getCart);

userRouter.post(
  "/cart/add",
  checkWhetherProfileIsCompleteMiddleware,
  RequestGuardMiddleware({ body: addToCartSchema }),
  addToCart,
);

userRouter.delete(
  "/cart/remove",
  checkWhetherProfileIsCompleteMiddleware,
  RequestGuardMiddleware({ body: removeFromCartSchema }),
  removeFromCart,
);

userRouter.delete("/cart/clear", checkWhetherProfileIsCompleteMiddleware, clearCart);
