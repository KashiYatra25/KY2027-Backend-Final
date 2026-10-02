import {
  authenticateUser,
  updatePhoneNumber,
  initiatePhoneNumberChange,
} from "@root/controller/user/auth/user.auth.controller.js";
import {
  updateProfile,
} from "@root/controller/user/profile/profile.controller.js";
import { submitContact } from "@root/controller/user/contact/contact.controller.js";
import { restProtectMiddleware } from "@middleware/protect/protect.factory.middleware.js";
import {
  changePhoneNumberSchema,
  userAuthSchema,
} from "@middleware/schemas/user/userAuth.schema.js";
import { updateProfileSchema } from "@middleware/schemas/user/profile.schema.js";
import { contactSchema } from "@middleware/schemas/user/contact.schema.js";
import { Router, type Router as ExpressRouter } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";
import {
  otpThrottleMiddleware,
  otpRateLimitMiddleware,
} from "@middleware/limiters/otp.middleware.js";
import { getOtp, verifyOtp } from "@root/controller/user/otp/otp.controller.js";
import {
  otpGenerationSchema,
  otpVerificationSchema,
} from "@middleware/schemas/user/otp.schema.js";

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
  RequestGuardMiddleware({ body: updateProfileSchema }),
  updateProfile,
);

// Phone number change flow
userRouter.get("/initialisePhoneNumberChange", initiatePhoneNumberChange);

userRouter.patch(
  "/updatePhoneNumber",
  RequestGuardMiddleware({ body: changePhoneNumberSchema }),
  updatePhoneNumber,
);

// OTP routes
userRouter.use("/otp", otpThrottleMiddleware, otpRateLimitMiddleware);

userRouter.post(
  "/otp/getOtp",
  RequestGuardMiddleware({ body: otpGenerationSchema }),
  getOtp,
);

userRouter.post(
  "/otp/verifyOtp",
  RequestGuardMiddleware({ body: otpVerificationSchema }),
  verifyOtp,
);
