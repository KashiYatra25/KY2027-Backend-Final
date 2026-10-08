import { authenticateUser } from "@controller/user/auth/index.js";
import { submitContact } from "@controller/user/contact/index.js";
import { updateProfile } from "@controller/user/profile/index.js";
import { addToCart } from "@controller/user/cart/addToCart.controller.js";
import { removeFromCart } from "@controller/user/cart/removeFromCart.controller.js";
import { clearCart } from "@controller/user/cart/clearCart.controller.js";
import { getCart } from "@controller/user/cart/getCart.controller.js";
import { restProtectMiddleware } from "@middleware/protect/protect.route.factory.middleware.js";
import { checkProfileUpdationAlreadyDoneOrNot } from "@middleware/user/profile/checkCollegeNotAlreadyCompleted.middleware.js";
import { checkWhetherProfileIsCompleteMiddleware } from "@middleware/user/checkWhetherProfileIsComplete.middleware.js";
import { isNotFromIITBhuMiddleware } from "@middleware/user/cart/isNotFromIITBhu.middleware.js";
import { isUserRoleMiddleware } from "@middleware/user/cart/isUserRole.middleware.js";
import { profileUpdationSchema } from "@schemas/user/profile.schema.js";
import { contactSchema } from "@schemas/user/contact.schema.js";
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

userRouter.patch(
  "/profile",
  RequestGuardMiddleware({ body: profileUpdationSchema }),
  checkProfileUpdationAlreadyDoneOrNot,
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
