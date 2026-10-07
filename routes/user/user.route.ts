import { authenticateUser } from "@controller/user/auth/index.js";
import { updateProfile } from "@controller/user/profile/index.js";
import { submitContact } from "@controller/user/contact/index.js";
import { searchUsers } from "@controller/user/search/index.js";
import { getMyRegistrations } from "@controller/user/event/index.js";
import { restProtectMiddleware } from "@middleware/protect/protect.route.factory.middleware.js";
import { blockIfProfileAlreadyCompleted } from "@middleware/user/profile/checkCollegeNotAlreadyCompleted.middleware.js";
import { profileUpdationSchema } from "@schemas/user/profile.schema.js";
import { contactSchema } from "@schemas/user/contact.schema.js";
import { searchUsersQuerySchema } from "@schemas/user/search.schema.js";
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
