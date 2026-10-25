/**
 * Rate Limiter Factory Middleware
 *
 * Creates configurable rate limiters using Redis for distributed limiting.
 * Supports both IP-based (for public routes) and User-based (for authenticated routes) limiting.
 *
 * @example
 * // IP-based limiter for public routes
 * const publicLimiter = createRateLimiter({
 *   keyGenerator: (req) => ({ type: 'ip', value: getClientIp(req) }),
 *   windowSeconds: 60,
 *   maxRequests: 100,
 *   routeName: 'public',
 * });
 *
 * // User-based limiter for authenticated routes
 * const authLimiter = createRateLimiter({
 *   keyGenerator: (req) => ({ type: 'user', value: req.user.id }),
 *   windowSeconds: 60,
 *   maxRequests: 30,
 *   routeName: 'cart',
 * });
 */

import type { Request, Response, NextFunction } from "express";
import { catchAsync, type BaseRequestHandler } from "zodex-axon/core";
import { redisService } from "@redis/index.js";
import { FIXED_WINDOW_RATE_LIMIT_SCRIPT } from "@redis/scripts/rateLimiter.lua.js";
import { getRouteRateLimitKey, getGlobalRateLimitKey } from "@redis/keys/redis.keys.js";
import { logger } from "@logger/logger.js";
import type {
  RateLimitIdentifier,
  RateLimiterConfig,
  RateLimitResult,
} from "./helper/types/rateLimiter.types.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Extract client IP from request
 * Uses req.clientIp which is set by requestContextMiddleware
 * (extracts from CF-Connecting-IP > X-Forwarded-For > req.ip)
 */
export const getClientIp = (req: Request): string => {
  return req.clientIp ?? req.ip ?? "unknown";
};

/**
 * Format seconds into human-readable string
 */
const formatTimeRemaining = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
};

/**
 * Send a 429 Too Many Requests response
 * Custom implementation since zodex-axon doesn't have TooManyRequestsError
 */
const sendRateLimitResponse = (
  res: Response,
  message: string,
  retryAfter: number,
): void => {
  res.status(429).json({
    success: false,
    statusCode: 429,
    info: message,
    retryAfter,
  });
};

// ═══════════════════════════════════════════════════════════════════
// RATE LIMIT CHECK FUNCTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Check rate limit against Redis
 * Returns result without throwing - allows caller to handle
 */
export const checkRateLimit = async (
  key: string,
  windowSeconds: number,
  maxRequests: number,
): Promise<RateLimitResult> => {
  try {
    const result = (await redisService.eval(
      FIXED_WINDOW_RATE_LIMIT_SCRIPT,
      [key],
      [String(windowSeconds), String(maxRequests)],
    )) as [number, number, number]; // [allowed, currentCount, ttl]

    const [allowed, currentCount, ttl] = result;

    return {
      allowed: allowed === 1,
      currentCount,
      remaining: Math.max(0, maxRequests - currentCount),
      resetInSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  } catch (error) {
    // On Redis error, allow the request (fail open)
    logger.error("Rate limiter Redis error - failing open", { 
      key, 
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      allowed: true,
      currentCount: 0,
      remaining: maxRequests,
      resetInSeconds: windowSeconds,
    };
  }
};

// ═══════════════════════════════════════════════════════════════════
// RATE LIMITER FACTORY
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a rate limiter middleware with the given configuration
 */
export const createRateLimiter = (config: RateLimiterConfig): BaseRequestHandler => {
  const {
    routeName,
    keyGenerator,
    windowSeconds,
    maxRequests,
    errorMessage,
    skipInDev = false,
    logHits = true,
  } = config;

  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // Skip in development if configured
    if (skipInDev && process.env.NODE_ENV === "development") {
      return next();
    }

    // Generate identifier and key
    const identifier = keyGenerator(req);
    const key = getRouteRateLimitKey(routeName, identifier);

    // Check rate limit
    const result = await checkRateLimit(key, windowSeconds, maxRequests);

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", result.remaining);
    res.setHeader("X-RateLimit-Reset", Math.floor(Date.now() / 1000) + result.resetInSeconds);

    if (!result.allowed) {
      // Log rate limit hit
      if (logHits) {
        logger.warn("Rate limit exceeded", {
          routeName,
          identifierType: identifier.type,
          identifierValue: identifier.type === "ip" ? identifier.value : "[user]",
          currentCount: result.currentCount,
          maxRequests,
          resetInSeconds: result.resetInSeconds,
          path: req.path,
          method: req.method,
        });
      }

      // Set Retry-After header
      res.setHeader("Retry-After", result.resetInSeconds);

      const message =
        errorMessage ??
        `Too many requests. Please try again in ${formatTimeRemaining(result.resetInSeconds)}.`;

      sendRateLimitResponse(res, message, result.resetInSeconds);
      return;
    }

    next();
  });
};

// ═══════════════════════════════════════════════════════════════════
// GLOBAL RATE LIMITER
// ═══════════════════════════════════════════════════════════════════

/**
 * Create global rate limiter (applies to all routes)
 * Uses IP-based limiting
 */
export const createGlobalRateLimiter = (
  windowSeconds: number,
  maxRequests: number,
): BaseRequestHandler => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const key = getGlobalRateLimitKey(ip);

    const result = await checkRateLimit(key, windowSeconds, maxRequests);

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", result.remaining);
    res.setHeader("X-RateLimit-Reset", Math.floor(Date.now() / 1000) + result.resetInSeconds);

    if (!result.allowed) {
      logger.warn("Global rate limit exceeded", {
        ip,
        currentCount: result.currentCount,
        maxRequests,
        path: req.path,
        method: req.method,
      });

      res.setHeader("Retry-After", result.resetInSeconds);

      sendRateLimitResponse(
        res,
        `Server is busy. Please try again in ${formatTimeRemaining(result.resetInSeconds)}.`,
        result.resetInSeconds,
      );
      return;
    }

    next();
  });
};

// ═══════════════════════════════════════════════════════════════════
// PRE-CONFIGURED LIMITERS (Convenience exports)
// ═══════════════════════════════════════════════════════════════════

/**
 * IP-based limiter for public/unauthenticated routes
 */
export const createIpBasedLimiter = (
  routeName: string,
  windowSeconds: number,
  maxRequests: number,
  options?: Partial<Omit<RateLimiterConfig, "routeName" | "keyGenerator" | "windowSeconds" | "maxRequests">>,
): BaseRequestHandler => {
  return createRateLimiter({
    routeName,
    keyGenerator: (req) => ({ type: "ip", value: getClientIp(req) }),
    windowSeconds,
    maxRequests,
    ...options,
  });
};

/**
 * User-based limiter for authenticated routes
 * Falls back to IP if user not available
 */
export const createUserBasedLimiter = (
  routeName: string,
  windowSeconds: number,
  maxRequests: number,
  options?: Partial<Omit<RateLimiterConfig, "routeName" | "keyGenerator" | "windowSeconds" | "maxRequests">>,
): BaseRequestHandler => {
  return createRateLimiter({
    routeName,
    keyGenerator: (req) => {
      const authReq = req as AuthenticatedUserRequestWithVerifiedEmail;
      if (authReq.user?.id) {
        return { type: "user", value: authReq.user.id };
      }
      // Fallback to IP if user not authenticated
      return { type: "ip", value: getClientIp(req) };
    },
    windowSeconds,
    maxRequests,
    ...options,
  });
};
