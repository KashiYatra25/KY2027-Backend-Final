import type { Request, Response, NextFunction } from "express";
import {
  getScheduleVersion,
  getScheduleCached,
  setScheduleCached,
} from "@redis/scheduleCache.service.js";
import { logCacheHit } from "@redis/entityCache.service.js";

// ═══════════════════════════════════════════════════════════════════
// SCHEDULE CACHE-READ MIDDLEWARE (public, global)
//
// Read-through cache for the public schedule endpoints. The cache key
// embeds the current schedule version (bumped on any admin write) plus a
// request-specific variant (query filters or venue slug). On a hit the
// cached JSON is returned and the controller is skipped; on a miss the
// controller's 2xx JSON response is captured and cached.
//
// Redis-failure-safe: the schedule cache service never throws, so an
// outage simply falls through to the controller (DB).
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a schedule cache middleware.
 *
 * @param keyFn - Builds the full cache key from the current version and the
 *   request (so query params / path params become part of the key).
 * @param name  - Label used in the green "Cache Hit" log (e.g. "schedule").
 */
export function scheduleCacheReadMiddleware(
  keyFn: (version: number, req: Request) => string,
  name: string,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const version = await getScheduleVersion();
    const cacheKey = keyFn(version, req);

    // 1. Hit → return immediately.
    const cached = await getScheduleCached<Record<string, unknown>>(cacheKey);
    if (cached) {
      logCacheHit(name);
      res.status(200).json(cached);
      return;
    }

    // 2. Miss → capture the controller's successful JSON response and cache it.
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        void setScheduleCached(cacheKey, body);
      }
      return originalJson(body);
    };

    next();
  };
}
