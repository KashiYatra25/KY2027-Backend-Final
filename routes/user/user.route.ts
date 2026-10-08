import { authenticateUser } from "@controller/user/auth/index.js";
import { submitContact } from "@controller/user/contact/index.js";
import { updateProfile } from "@controller/user/profile/index.js";
import { restProtectMiddleware, roleChecker } from "@middleware/protect/protect.route.factory.middleware.js";
import { blockIfProfileAlreadyCompleted } from "@middleware/user/profile/checkCollegeNotAlreadyCompleted.middleware.js";
import { addToCartSchema, removeFromCartSchema } from "@root/controller/middleware/schemas/user/cart.schema";
import { searchUsersQuerySchema } from "@root/controller/middleware/schemas/user/search.schema";
import { isNotFromIITBhuMiddleware } from "@root/controller/middleware/user/cart/isNotFromIITBhu.middleware";
import { checkWhetherProfileIsCompleteMiddleware } from "@root/controller/middleware/user/profile/checkWhetherProfileIsComplete.middleware";
import { addToCart } from "@root/controller/user/cart/addToCart.controller";
import { clearCart } from "@root/controller/user/cart/clearCart.controller";
import { getCart } from "@root/controller/user/cart/getCart.controller";
import { removeFromCart } from "@root/controller/user/cart/removeFromCart.controller";
import { getMyRegistrations } from "@root/controller/user/event";
import { getPaymentStatus } from "@root/controller/user/payment";
import { searchUsers } from "@root/controller/user/search";
import { contactSchema } from "@schemas/user/contact.schema.js";
import { profileUpdationSchema } from "@schemas/user/profile.schema.js";
import { userAuthSchema } from "@schemas/user/user.auth.schema.js";
import { Router, type Router as ExpressRouter } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";

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

userRouter.patch(
  "/profile",
  RequestGuardMiddleware({ body: profileUpdationSchema }),
  blockIfProfileAlreadyCompleted,
  updateProfile,
);

// Phone number change flow
// userRouter.get("/initialisePhoneNumberChange", initiatePhoneNumberChange);


// we are not allowing the phone number updates for now
// userRouter.patch(
//   "/updatePhoneNumber",
//   validateCSRFToken,
//   RequestGuardMiddleware({ body: changePhoneNumberSchema }),
//   updatePhoneNumber,
// );

// OTP routes -> if in case in future we required to use otp
// userRouter.use("/otp", otpThrottleMiddleware, otpRateLimitMiddleware);

// userRouter.post(
//   "/otp/getOtp",
//   RequestGuardMiddleware({ body: otpGenerationSchema }),
//   getOtp,
// );

// userRouter.post(
//   "/otp/verifyOtp",
//   RequestGuardMiddleware({ body: otpVerificationSchema }),
//   verifyOtp,
// );

// ═══════════════════════════════════════════════════════════════════
// CART ROUTES
// Only for: Authenticated + Profile Complete + USER role + Non-IIT BHU users
// ═══════════════════════════════════════════════════════════════════

const cartMiddlewares = [
  checkWhetherProfileIsCompleteMiddleware,
  roleChecker("REST" , "USER"),
  isNotFromIITBhuMiddleware,
];

userRouter.get("/cart", ...cartMiddlewares, getCart);

userRouter.post(
  "/cart/add",
  ...cartMiddlewares,
  RequestGuardMiddleware({ body: addToCartSchema }),
  addToCart,
);

userRouter.delete(
  "/cart/remove",
  ...cartMiddlewares,
  RequestGuardMiddleware({ body: removeFromCartSchema }),
  removeFromCart,
);

userRouter.delete("/cart/clear", ...cartMiddlewares, clearCart);
