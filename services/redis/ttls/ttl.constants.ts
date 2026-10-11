// User related TTLs
const ACCOUNT_PROGRESS_TTL = 60 * 60; // 1 hour
const PROFILE_COMPLETION_TTL = 60 * 60; // 1 hour

// ═══════════════════════════════════════════════════════════════════
// RATE LIMITER TTLs (Window sizes in seconds)
// ═══════════════════════════════════════════════════════════════════

/**
 * Global rate limiter window
 * 100 requests per minute per IP across all endpoints
 */
const GLOBAL_RATE_LIMIT_WINDOW = 60; // 1 minute
const GLOBAL_RATE_LIMIT_MAX = 100;

/**
 * Auth endpoint - strict to prevent credential stuffing
 * 10 requests per minute per IP
 */
const AUTH_RATE_LIMIT_WINDOW = 60; // 1 minute
const AUTH_RATE_LIMIT_MAX = 10;

/**
 * Aadhaar operations - expensive AWS calls
 * 5 requests per minute per user
 */
const AADHAAR_RATE_LIMIT_WINDOW = 60; // 1 minute
const AADHAAR_RATE_LIMIT_MAX = 5;

/**
 * CA Application - prevent spam
 * 3 requests per hour per user
 */
const CA_APPLICATION_RATE_LIMIT_WINDOW = 60 * 60; // 1 hour
const CA_APPLICATION_RATE_LIMIT_MAX = 3;

/**
 * Referral application - prevent abuse
 * 10 requests per minute per user
 */
const REFERRAL_RATE_LIMIT_WINDOW = 60; // 1 minute
const REFERRAL_RATE_LIMIT_MAX = 10;

/**
 * Cart operations - moderate limit
 * 30 requests per minute per user
 */
const CART_RATE_LIMIT_WINDOW = 60; // 1 minute
const CART_RATE_LIMIT_MAX = 30;

/**
 * Contact form - prevent spam
 * 5 requests per hour per IP
 */
const CONTACT_RATE_LIMIT_WINDOW = 60 * 60; // 1 hour
const CONTACT_RATE_LIMIT_MAX = 5;

/**
 * Admin actions - moderate limit
 * 30 requests per minute per user
 */
const ADMIN_RATE_LIMIT_WINDOW = 60; // 1 minute
const ADMIN_RATE_LIMIT_MAX = 30;

/**
 * Public GET endpoints - lenient
 * 60 requests per minute per IP
 */
const PUBLIC_RATE_LIMIT_WINDOW = 60; // 1 minute
const PUBLIC_RATE_LIMIT_MAX = 60;

/**
 * Search endpoint - moderate (debounced on frontend)
 * 30 requests per minute per user
 */
const SEARCH_RATE_LIMIT_WINDOW = 60; // 1 minute
const SEARCH_RATE_LIMIT_MAX = 30;

// ═══════════════════════════════════════════════════════════════════
// ADMIN JWT TOKEN TTLs
// ═══════════════════════════════════════════════════════════════════

/**
 * Admin refresh token TTL in Redis
 * Should match JWT refresh token expiry (7 days)
 */
const ADMIN_REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days

/**
 * Admin token blacklist TTL
 * Should be at least as long as refresh token expiry
 * to prevent reuse of revoked tokens
 */
const ADMIN_TOKEN_BLACKLIST_TTL = 7 * 24 * 60 * 60; // 7 days

/**
 * Admin session TTL
 * Tracks active admin sessions for security monitoring
 */
const ADMIN_SESSION_TTL = 7 * 24 * 60 * 60; // 7 days

export {
  ACCOUNT_PROGRESS_TTL,
  PROFILE_COMPLETION_TTL,
  // Rate limiter windows and limits
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
  // Admin JWT TTLs
  ADMIN_REFRESH_TOKEN_TTL,
  ADMIN_TOKEN_BLACKLIST_TTL,
  ADMIN_SESSION_TTL,
};
