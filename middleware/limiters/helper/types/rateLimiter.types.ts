import type { Request } from "express";

/**
 * Identifier for rate limiting - either by IP or user ID
 */
export type RateLimitIdentifier =
  | { type: "ip"; value: string }
  | { type: "user"; value: string };

/**
 * Configuration for a rate limiter
 */
export interface RateLimiterConfig {
  /** Unique name for this limiter (used in Redis key) */
  routeName: string;

  /** Function to extract identifier from request */
  keyGenerator: (req: Request) => RateLimitIdentifier;

  /** Time window in seconds */
  windowSeconds: number;

  /** Maximum requests allowed in window */
  maxRequests: number;

  /** Custom error message (optional) */
  errorMessage?: string;

  /** Whether to skip rate limiting in development (default: false) */
  skipInDev?: boolean;

  /** Whether to log rate limit hits (default: true) */
  logHits?: boolean;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  remaining: number;
  resetInSeconds: number;
}
