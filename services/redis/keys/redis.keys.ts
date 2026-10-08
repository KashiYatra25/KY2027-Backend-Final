// OTP related keys
const getOtpThrottleKey = (userId: string) => `otp:throttle:${userId}`;
const getOtpRateLimitKey = (userId: string) => `otp:rateLimit:${userId}`;

// User profile keys
const getAccountProgressKey = (userId: string) => `accountProgress:${userId}`;
const getProfileCompletionKey = (userId: string) =>
  `profileCompletion:${userId}`;

// CA Referral ID generation keys
const CA_REFERRAL_RANGE_CURSOR_KEY = "ca:referral:range:cursor";

// ═══════════════════════════════════════════════════════════════════
// RATE LIMITER KEYS
// Format: rl:<scope>:<identifier>:<route-name>
// ═══════════════════════════════════════════════════════════════════

/**
 * Global rate limiter key (per IP)
 * Applies to all requests before any route-specific limiting
 */
const getGlobalRateLimitKey = (ip: string) => `rl:global:ip:${ip}`;

/**
 * Route-specific rate limiter key (per IP)
 * For unauthenticated/public routes
 */
const getRouteRateLimitKeyByIp = (routeName: string, ip: string) =>
  `rl:route:${routeName}:ip:${ip}`;

/**
 * Route-specific rate limiter key (per User)
 * For authenticated routes - more accurate than IP
 */
const getRouteRateLimitKeyByUser = (routeName: string, userId: string) =>
  `rl:route:${routeName}:user:${userId}`;

/**
 * Combined key generator - picks IP or User based on auth status
 */
const getRouteRateLimitKey = (
  routeName: string,
  identifier: { type: "ip"; value: string } | { type: "user"; value: string },
) => {
  if (identifier.type === "user") {
    return getRouteRateLimitKeyByUser(routeName, identifier.value);
  }
  return getRouteRateLimitKeyByIp(routeName, identifier.value);
};

/**
 * Auth endpoint rate limiter (per IP) - prevents credential stuffing
 */
const getAuthRateLimitKey = (ip: string) => `rl:auth:ip:${ip}`;

/**
 * Aadhaar/expensive operation rate limiter (per User)
 */
const getAadhaarRateLimitKey = (userId: string) => `rl:aadhaar:user:${userId}`;

/**
 * CA application rate limiter (per User) - prevent spam applications
 */
const getCaApplicationRateLimitKey = (userId: string) =>
  `rl:ca-apply:user:${userId}`;

/**
 * Referral application rate limiter (per User)
 */
const getReferralRateLimitKey = (userId: string) =>
  `rl:referral:user:${userId}`;

/**
 * Cart operation rate limiter (per User)
 */
const getCartRateLimitKey = (userId: string) => `rl:cart:user:${userId}`;

/**
 * Contact form rate limiter (per IP) - prevent spam
 */
const getContactRateLimitKey = (ip: string) => `rl:contact:ip:${ip}`;

/**
 * Admin action rate limiter (per User)
 */
const getAdminRateLimitKey = (userId: string) => `rl:admin:user:${userId}`;

export {
  getOtpRateLimitKey,
  getOtpThrottleKey,
  getAccountProgressKey,
  getProfileCompletionKey,
  CA_REFERRAL_RANGE_CURSOR_KEY,
  // Rate limiter keys
  getGlobalRateLimitKey,
  getRouteRateLimitKey,
  getRouteRateLimitKeyByIp,
  getRouteRateLimitKeyByUser,
  getAuthRateLimitKey,
  getAadhaarRateLimitKey,
  getCaApplicationRateLimitKey,
  getReferralRateLimitKey,
  getCartRateLimitKey,
  getContactRateLimitKey,
  getAdminRateLimitKey,
};
