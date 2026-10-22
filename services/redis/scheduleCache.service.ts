import { redisService } from "@redis/index.js";
import { SCHEDULE_CACHE_VERSION_KEY } from "@redis/keys/redis.keys.js";
import { SCHEDULE_CACHE_TTL } from "@redis/ttls/ttl.constants.js";
import { getCached, setCached } from "@redis/entityCache.service.js";
import { logger } from "@logger/logger.js";

// ═══════════════════════════════════════════════════════════════════
// SCHEDULE CACHE SERVICE (global, version-counter invalidation)
//
// The schedule read endpoints vary by query/slug, so instead of tracking
// individual keys we embed a global version number in every key. Any admin
// write bumps the version (INCR), which instantly makes all previously
// cached variants unreachable — they expire naturally via TTL.
//
// All operations are Redis-failure-safe: on any error we behave as a cache
// miss / no-op, and the caller falls back to the database.
// ═══════════════════════════════════════════════════════════════════

/**
 * Read the current schedule cache version. Defaults to 1 when unset, and
 * returns 1 on any Redis error (so key-building never fails).
 */
export async function getScheduleVersion(): Promise<number> {
  try {
    const raw = await redisService.get(SCHEDULE_CACHE_VERSION_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 1;
  } catch {
    return 1;
  }
}

/**
 * Bump the schedule cache version (INCR). Called after ANY admin write to
 * venues / fest days / schedule entries. Never throws.
 */
export async function bumpScheduleCacheVersion(): Promise<void> {
  try {
    await redisService.incr(SCHEDULE_CACHE_VERSION_KEY);
    logger.debug("Schedule cache version bumped");
  } catch (error) {
    logger.warn("Schedule cache bump failed (ignored)", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Read a schedule cache entry (JSON). Null on miss or any error. */
export async function getScheduleCached<T>(key: string): Promise<T | null> {
  return getCached<T>(key);
}

/** Write a schedule cache entry with the schedule TTL. Never throws. */
export async function setScheduleCached(key: string, value: unknown): Promise<void> {
  await setCached(key, value, SCHEDULE_CACHE_TTL);
}
