// Rate Limiter Factory & Helpers
export {
  createRateLimiter,
  createGlobalRateLimiter,
  createIpBasedLimiter,
  createUserBasedLimiter,
  checkRateLimit,
  getClientIp,
  type RateLimiterConfig,
  type RateLimitIdentifier,
  type RateLimitResult,
} from "./rateLimiter.factory.js";

// Pre-configured Rate Limiters
export {
  // Global
  globalRateLimiter,
  // Auth & Security
  authRateLimiter,
  adminRateLimiter,
  // Expensive Operations
  aadhaarRateLimiter,
  // CA
  caApplicationRateLimiter,
  referralRateLimiter,
  caPublicRateLimiter,
  // User Actions
  cartRateLimiter,
  searchRateLimiter,
  profileRateLimiter,
  // Public
  contactRateLimiter,
  publicReadRateLimiter,
  // Events & Teams
  eventRegistrationRateLimiter,
  teamRateLimiter,
} from "./rateLimiters.js";

// OTP Limiters (existing)
export {
  otpRateLimitMiddleware,
  otpThrottleMiddleware,
} from "./otp.middleware.js";
