// Types
export type {
  RateLimiterConfig,
  RateLimitIdentifier,
  RateLimitResult,
} from "./helper/types/rateLimiter.types.js";

// Rate Limiter Factory & Helpers
export {
  createRateLimiter,
  createGlobalRateLimiter,
  createIpBasedLimiter,
  createUserBasedLimiter,
  checkRateLimit,
  getClientIp,
} from "./rateLimiter.factory.js";

// Pre-configured Rate Limiters
export {
  globalRateLimiter,
  authRateLimiter,
  adminRateLimiter,
  aadhaarRateLimiter,
  caApplicationRateLimiter,
  referralRateLimiter,
  caPublicRateLimiter,
  cartRateLimiter,
  searchRateLimiter,
  profileRateLimiter,
  contactRateLimiter,
  publicReadRateLimiter,
  eventRegistrationRateLimiter,
  teamRateLimiter,
} from "./rateLimiters.js";

// OTP Limiters
export {
  otpRateLimitMiddleware,
  otpThrottleMiddleware,
} from "./otp.middleware.js";
