// OTP related keys
const getOtpThrottleKey = (userId: string) => `otp:throttle:${userId}`;
const getOtpRateLimitKey = (userId: string) => `otp:rateLimit:${userId}`;

// User profile keys
const getAccountProgressKey = (userId: string) => `accountProgress:${userId}`;
const getProfileCompletionKey = (userId: string) =>
  `profileCompletion:${userId}`;

// ═══════════════════════════════════════════════════════════════════
// ENTITY CACHE KEYS (read-through caches)
// Versioned ("v1") so the shape can be invalidated globally on changes.
// One key per user holds the full JSON response for that endpoint.
// ═══════════════════════════════════════════════════════════════════
const CACHE_VERSION = "v1";

/** Cached GraphQL `myAccount` response (profile + progress). */
const getMyAccountCacheKey = (userId: string) =>
  `cache:${CACHE_VERSION}:myAccount:${userId}`;

/** Cached `GET /teams/my` response. */
const getMyTeamsCacheKey = (userId: string) =>
  `cache:${CACHE_VERSION}:teams:${userId}`;

/** Cached `GET /user/registrations` response. */
const getMyRegistrationsCacheKey = (userId: string) =>
  `cache:${CACHE_VERSION}:registrations:${userId}`;

// ── Schedule cache (GLOBAL, shared across all users) ──────────────────
// Schedule data is global and rarely changes but is read on every
// schedule-page load. Because the read endpoints vary by query/slug, we
// use a version counter: each variant key embeds the current version, and
// any admin write bumps the version — instantly orphaning every old
// variant (they then expire via TTL). No key enumeration needed.

/** Holds the current schedule cache version integer. */
const SCHEDULE_CACHE_VERSION_KEY = `cache:${CACHE_VERSION}:schedule:ver`;

/** Full schedule response; `variant` encodes the day/venue/category filters. */
const getScheduleCacheKey = (version: number, variant: string) =>
  `cache:${CACHE_VERSION}:schedule:full:${version}:${variant}`;

/** All venues response. */
const getScheduleVenuesCacheKey = (version: number) =>
  `cache:${CACHE_VERSION}:schedule:venues:${version}`;

/** All fest days response. */
const getScheduleFestDaysCacheKey = (version: number) =>
  `cache:${CACHE_VERSION}:schedule:days:${version}`;

/** Per-venue schedule response. */
const getVenueScheduleCacheKey = (version: number, venueSlug: string) =>
  `cache:${CACHE_VERSION}:schedule:venue:${version}:${venueSlug}`;

// ── Passes cache (GLOBAL, shared across all users) ────────────────────
// `GET /pass` returns the same active-passes list for everyone and is only
// ever written by the offline seed script (no runtime admin endpoint). So a
// single global key with a TTL backstop is sufficient — no per-user keys and
// no version counter needed. A re-seed is picked up once the TTL lapses.

/** Cached `GET /pass` response (all active passes). */
const PASSES_CACHE_KEY = `cache:${CACHE_VERSION}:passes`;

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

// ═══════════════════════════════════════════════════════════════════
// ADMIN JWT TOKEN KEYS
// For refresh token storage and blacklisting
// ═══════════════════════════════════════════════════════════════════

/**
 * Admin refresh token key - stores the valid refresh token JTI for a user
 * Only one refresh token is valid per admin at a time
 */
const getAdminRefreshTokenKey = (userId: string) =>
  `admin:refresh:${userId}`;

/**
 * Admin token blacklist key - stores blacklisted token JTIs
 * Used to invalidate tokens on logout or password change
 */
const getAdminTokenBlacklistKey = (jti: string) =>
  `admin:blacklist:${jti}`;

/**
 * Admin active sessions key - tracks active admin sessions
 */
const getAdminActiveSessionKey = (userId: string) =>
  `admin:session:${userId}`;

export {
  getOtpRateLimitKey,
  getOtpThrottleKey,
  getAccountProgressKey,
  getProfileCompletionKey,
  getMyAccountCacheKey,
  getMyTeamsCacheKey,
  getMyRegistrationsCacheKey,
  SCHEDULE_CACHE_VERSION_KEY,
  getScheduleCacheKey,
  getScheduleVenuesCacheKey,
  getScheduleFestDaysCacheKey,
  getVenueScheduleCacheKey,
  PASSES_CACHE_KEY,
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
  // Admin JWT keys
  getAdminRefreshTokenKey,
  getAdminTokenBlacklistKey,
  getAdminActiveSessionKey,
};
