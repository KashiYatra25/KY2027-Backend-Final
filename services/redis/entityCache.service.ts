import { redisService } from "@redis/index.js";
import {
  getMyAccountCacheKey,
  getMyTeamsCacheKey,
  getMyRegistrationsCacheKey,
} from "@redis/keys/redis.keys.js";
import { ENTITY_CACHE_TTL } from "@redis/ttls/ttl.constants.js";
import { logger } from "@logger/logger.js";

// ANSI green so cache hits stand out in the dev terminal. The codes are
// harmless in the structured (Loki/JSON) transports.
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

/**
 * Log a green "Cache Hit" line naming the cache that was served, e.g.
 *   ✓ Cache Hit → profile
 */
export function logCacheHit(name: string): void {
  logger.info(`${GREEN}✓ Cache Hit → ${name}${RESET}`);
}

// ═══════════════════════════════════════════════════════════════════
// ENTITY CACHE SERVICE
//
// Read-through JSON caching for the profile (myAccount), teams, and
// registrations endpoints. Every operation is wrapped so that a Redis
// failure NEVER breaks the request — reads fall back to the DB, and
// writes/invalidations fail silently (the TTL backstop + next write
// will self-heal).
// ═══════════════════════════════════════════════════════════════════

/**
 * Read a cached JSON value. Returns null on miss OR on any Redis error
 * (so the caller transparently falls back to the database).
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await redisService.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    logger.warn("Cache read failed (falling back to DB)", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Write a value to the cache. Defaults to the entity TTL; pass `ttl` to
 * override (e.g. the schedule cache uses a longer backstop).
 * Fire-and-forget: never throws, never blocks the response on failure.
 */
export async function setCached(
  key: string,
  value: unknown,
  ttl: number = ENTITY_CACHE_TTL,
): Promise<void> {
  try {
    await redisService.set(key, JSON.stringify(value), "EX", ttl);
  } catch (error) {
    logger.warn("Cache write failed (ignored)", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Delete one or more cache keys. Never throws.
 */
export async function invalidateCache(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await redisService.delete(...keys);
  } catch (error) {
    logger.warn("Cache invalidation failed (ignored)", {
      keys,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ── Typed invalidation helpers ──────────────────────────────────────

/** Invalidate the cached profile (myAccount) for a user. */
export async function invalidateProfileCache(userId: string): Promise<void> {
  await invalidateCache(getMyAccountCacheKey(userId));
}

/** Invalidate the cached teams list for one or more users (fan-out). */
export async function invalidateTeamsCache(
  userIds: string | string[],
): Promise<void> {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  if (ids.length === 0) return;
  await invalidateCache(...ids.map(getMyTeamsCacheKey));
}

/** Invalidate the cached registrations list for one or more users (fan-out). */
export async function invalidateRegistrationsCache(
  userIds: string | string[],
): Promise<void> {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  if (ids.length === 0) return;
  await invalidateCache(...ids.map(getMyRegistrationsCacheKey));
}
