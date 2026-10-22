import type { Request, Response, NextFunction } from "express";
import { getCached, setCached, logCacheHit } from "@redis/entityCache.service.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";

// ═══════════════════════════════════════════════════════════════════
// CACHE-READ MIDDLEWARE (REST)
//
// Read-through cache for authenticated GET endpoints. On a cache hit the
// cached JSON is returned immediately and the controller is skipped. On a
// miss the controller runs, and its successful (2xx) JSON response is
// captured and written to the cache.
//
// Safe by design: all Redis access goes through the entityCache service
// which never throws — a Redis outage simply falls through to the
// controller (DB), so caching can never break the endpoint.
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a cache middleware for a user-scoped GET endpoint.
 *
 * @param keyFn - Builds the Redis cache key from the authenticated userId.
 * @param name  - Label used in the green "Cache Hit" log (e.g. "teams").
 */
export function cacheReadMiddleware(
  keyFn: (userId: string) => string,
  name: string,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthenticatedUserRequestWithVerifiedEmail;
    const userId = authReq.user?.id;

    // No authenticated user → nothing to key on; let the chain proceed.
    if (!userId) {
      next();
      return;
    }

    const cacheKey = keyFn(userId);

    // 1. Cache hit → return immediately.
    const cached = await getCached<Record<string, unknown>>(cacheKey);
    if (cached) {
      logCacheHit(name);
      res.status(200).json(cached);
      return;
    }

    // 2. Miss → capture the controller's JSON response and cache it (2xx only).
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Fire-and-forget; never blocks the response.
        void setCached(cacheKey, body);
      }
      return originalJson(body);
    };

    next();
  };
}
