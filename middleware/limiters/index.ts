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
  globalRateLimiterMiddleware,
  authRateLimiterMiddleware,
  adminRateLimiterMiddleware,
  aadhaarRateLimiterMiddleware,
  caApplicationRateLimiterMiddleware,
  referralRateLimiterMiddleware,
  caPublicRateLimiterMiddleware,
  cartRateLimiterMiddleware,
  searchRateLimiterMiddleware,
  profileRateLimiterMiddleware,
  contactRateLimiterMiddleware,
  publicReadRateLimiterMiddleware,
  eventRegistrationRateLimiterMiddleware,
  teamRateLimiterMiddleware,
} from "./rateLimiters.js";

// OTP Limiters
export {
  otpRateLimitMiddleware,
  otpThrottleMiddleware,
} from "./otp.middleware.js";
