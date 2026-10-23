import { redisService } from "@redis/index.js";
import { EVENTS_CACHE_VERSION_KEY } from "@redis/keys/redis.keys.js";
import { SCHEDULE_CACHE_TTL } from "@redis/ttls/ttl.constants.js";
import { getCached, setCached } from "@redis/entityCache.service.js";
import { logger } from "@logger/logger.js";

// ═══════════════════════════════════════════════════════════════════
// EVENTS CACHE SERVICE (global, version-counter invalidation)
//
// `GET /events` (filterable) and `GET /events/:slug` return the same data for
// every user and change only via the seed script (no runtime event-edit
// endpoint yet). Reads have many variants, so — exactly like the schedule
// cache — we embed a global version number in every key. Any write bumps the
// version (INCR), instantly orphaning every previously cached variant (they
// then expire via the long TTL, shared with schedule/passes).
//
// All operations are Redis-failure-safe: on any error we behave as a cache
// miss / no-op and the caller falls back to the database.
// ═══════════════════════════════════════════════════════════════════

/**
 * Read the current events cache version. Defaults to 1 when unset, and returns
 * 1 on any Redis error (so key-building never fails).
 */
export async function getEventsVersion(): Promise<number> {
  try {
    const raw = await redisService.get(EVENTS_CACHE_VERSION_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 1;
  } catch {
    return 1;
  }
}

/**
 * Bump the events cache version (INCR). Call after ANY write to events
 * (currently the seed script; any future runtime event-edit endpoint MUST call
 * this too). Never throws.
 */
export async function bumpEventsCacheVersion(): Promise<void> {
  try {
    await redisService.incr(EVENTS_CACHE_VERSION_KEY);
    logger.debug("Events cache version bumped");
  } catch (error) {
    logger.warn("Events cache bump failed (ignored)", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Read an events cache entry (JSON). Null on miss or any error. */
export async function getEventsCached<T>(key: string): Promise<T | null> {
  return getCached<T>(key);
}

/** Write an events cache entry with the long (schedule/passes) TTL. Never throws. */
export async function setEventsCached(key: string, value: unknown): Promise<void> {
  await setCached(key, value, SCHEDULE_CACHE_TTL);
}
