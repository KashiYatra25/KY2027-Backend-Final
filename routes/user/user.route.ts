import { authenticateUser } from "@controller/user/auth/index.js";
import { updateProfile } from "@controller/user/profile/index.js";
import { submitContact } from "@controller/user/contact/index.js";
import { updateProfile } from "@controller/user/profile/index.js";
import { restProtectMiddleware } from "@middleware/protect/protect.route.factory.middleware.js";
import { checkProfileUpdationAlreadyDoneOrNot } from "@middleware/user/profile/checkCollegeNotAlreadyCompleted.middleware.js";
import { profileUpdationSchema } from "@schemas/user/profile.schema.js";
import { contactSchema } from "@schemas/user/contact.schema.js";
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
  isUserRoleMiddleware,
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
