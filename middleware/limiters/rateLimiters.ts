/**
 * Route-Specific Rate Limiters
 *
 * Pre-configured rate limiters for different endpoint categories.
 * Import and use these in your route files.
 *
 * @example
 * // In user.route.ts
 * import { authRateLimiter, cartRateLimiter } from "@middleware/limiters/rateLimiters.js";
 *
 * userRouter.post("/auth", authRateLimiter, authenticateUser);
 * userRouter.post("/cart/add", cartRateLimiter, addToCart);
 */

import {
  createIpBasedLimiter,
  createUserBasedLimiter,
  createGlobalRateLimiter,
} from "./rateLimiter.factory.js";
import {
  GLOBAL_RATE_LIMIT_WINDOW,
  GLOBAL_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_WINDOW,
  AUTH_RATE_LIMIT_MAX,
  AADHAAR_RATE_LIMIT_WINDOW,
  AADHAAR_RATE_LIMIT_MAX,
  CA_APPLICATION_RATE_LIMIT_WINDOW,
  CA_APPLICATION_RATE_LIMIT_MAX,
  REFERRAL_RATE_LIMIT_WINDOW,
  REFERRAL_RATE_LIMIT_MAX,
  CART_RATE_LIMIT_WINDOW,
  CART_RATE_LIMIT_MAX,
  CONTACT_RATE_LIMIT_WINDOW,
  CONTACT_RATE_LIMIT_MAX,
  ADMIN_RATE_LIMIT_WINDOW,
  ADMIN_RATE_LIMIT_MAX,
  PUBLIC_RATE_LIMIT_WINDOW,
  PUBLIC_RATE_LIMIT_MAX,
  SEARCH_RATE_LIMIT_WINDOW,
  SEARCH_RATE_LIMIT_MAX,
} from "@redis/ttls/ttl.constants.js";

// ═══════════════════════════════════════════════════════════════════
// GLOBAL LIMITER
// ═══════════════════════════════════════════════════════════════════

/**
 * Global rate limiter - applies to ALL requests
 * 100 requests/minute per IP
 * Use in app.ts before all routes
 */
export const globalRateLimiter = createGlobalRateLimiter(
  GLOBAL_RATE_LIMIT_WINDOW,
  GLOBAL_RATE_LIMIT_MAX,
);

// ═══════════════════════════════════════════════════════════════════
// AUTHENTICATION & SECURITY
// ═══════════════════════════════════════════════════════════════════

/**
 * Auth endpoint limiter (IP-based)
 * Strict limit to prevent credential stuffing
 * 10 requests/minute per IP
 */
export const authRateLimiter = createIpBasedLimiter(
  "auth",
  AUTH_RATE_LIMIT_WINDOW,
  AUTH_RATE_LIMIT_MAX,
  {
    errorMessage: "Too many authentication attempts. Please wait before trying again.",
  },
);

/**
 * Admin actions limiter (User-based)
 * 30 requests/minute per user
 */
export const adminRateLimiter = createUserBasedLimiter(
  "admin",
  ADMIN_RATE_LIMIT_WINDOW,
  ADMIN_RATE_LIMIT_MAX,
  {
    errorMessage: "Too many admin requests. Please slow down.",
  },
);

// ═══════════════════════════════════════════════════════════════════
// EXPENSIVE OPERATIONS (AWS COSTS)
// ═══════════════════════════════════════════════════════════════════

/**
 * Aadhaar operations limiter (User-based)
 * Strict limit - AWS Textract costs money
 * 5 requests/minute per user
 */
export const aadhaarRateLimiter = createUserBasedLimiter(
  "aadhaar",
  AADHAAR_RATE_LIMIT_WINDOW,
  AADHAAR_RATE_LIMIT_MAX,
  {
    errorMessage: "Too many Aadhaar verification requests. Please wait before trying again.",
  },
);

// ═══════════════════════════════════════════════════════════════════
// CAMPUS AMBASSADOR
// ═══════════════════════════════════════════════════════════════════

/**
 * CA Application limiter (User-based)
 * Very strict - prevent spam applications
 * 3 requests/hour per user
 */
export const caApplicationRateLimiter = createUserBasedLimiter(
  "ca-apply",
  CA_APPLICATION_RATE_LIMIT_WINDOW,
  CA_APPLICATION_RATE_LIMIT_MAX,
  {
    errorMessage: "You've made too many CA application attempts. Please try again later.",
  },
);

/**
 * Referral application limiter (User-based)
 * Moderate limit
 * 10 requests/minute per user
 */
export const referralRateLimiter = createUserBasedLimiter(
  "referral",
  REFERRAL_RATE_LIMIT_WINDOW,
  REFERRAL_RATE_LIMIT_MAX,
  {
    errorMessage: "Too many referral requests. Please wait before trying again.",
  },
);

// ═══════════════════════════════════════════════════════════════════
// USER ACTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Cart operations limiter (User-based)
 * Moderate limit for cart add/update/remove
 * 30 requests/minute per user
 */
export const cartRateLimiter = createUserBasedLimiter(
  "cart",
  CART_RATE_LIMIT_WINDOW,
  CART_RATE_LIMIT_MAX,
  {
    errorMessage: "Too many cart operations. Please slow down.",
  },
);

/**
 * Search limiter (User-based)
 * Frontend should debounce, but this is a safety net
 * 30 requests/minute per user
 */
export const searchRateLimiter = createUserBasedLimiter(
  "search",
  SEARCH_RATE_LIMIT_WINDOW,
  SEARCH_RATE_LIMIT_MAX,
  {
    errorMessage: "Too many search requests. Please wait before searching again.",
  },
);

/**
 * Profile update limiter (User-based)
 * Moderate limit
 * 20 requests/minute per user
 */
export const profileRateLimiter = createUserBasedLimiter(
  "profile",
  60, // 1 minute
  20,
  {
    errorMessage: "Too many profile update attempts. Please wait before trying again.",
  },
);

// ═══════════════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Contact form limiter (IP-based)
 * Strict to prevent spam
 * 5 requests/hour per IP
 */
export const contactRateLimiter = createIpBasedLimiter(
  "contact",
  CONTACT_RATE_LIMIT_WINDOW,
  CONTACT_RATE_LIMIT_MAX,
  {
    errorMessage: "Too many contact form submissions. Please try again later.",
  },
);

/**
 * Public GET endpoints limiter (IP-based)
 * Lenient - for /events, /pass, /ca/leaderboard, etc.
 * 60 requests/minute per IP
 */
export const publicReadRateLimiter = createIpBasedLimiter(
  "public",
  PUBLIC_RATE_LIMIT_WINDOW,
  PUBLIC_RATE_LIMIT_MAX,
);

/**
 * CA Leaderboard/Validate limiter (IP-based)
 * Public endpoints but can be abused
 * 30 requests/minute per IP
 */
export const caPublicRateLimiter = createIpBasedLimiter(
  "ca-public",
  60, // 1 minute
  30,
);

// ═══════════════════════════════════════════════════════════════════
// EVENT & TEAM
// ═══════════════════════════════════════════════════════════════════

/**
 * Event registration limiter (User-based)
 * Moderate limit
 * 20 requests/minute per user
 */
export const eventRegistrationRateLimiter = createUserBasedLimiter(
  "event-register",
  60, // 1 minute
  20,
  {
    errorMessage: "Too many event registration attempts. Please wait before trying again.",
  },
);

/**
 * Team creation limiter (User-based)
 * Strict - teams are permanent
 * 10 requests/minute per user
 */
export const teamRateLimiter = createUserBasedLimiter(
  "team",
  60, // 1 minute
  10,
  {
    errorMessage: "Too many team operations. Please wait before trying again.",
  },
);
