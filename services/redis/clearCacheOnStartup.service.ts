import { redisService } from "@redis/index.js";
import { logger } from "@logger/logger.js";
import {
  SCHEDULE_CACHE_VERSION_KEY,
  EVENTS_CACHE_VERSION_KEY,
} from "@redis/keys/redis.keys.js";

// ═══════════════════════════════════════════════════════════════════
// CLEAR ALL APPLICATION CACHES ON SERVER STARTUP
//
// This ensures fresh data after deployments/restarts. Clears:
// - Schedule cache (bumps version to orphan all variants)
// - Events cache (bumps version to orphan all variants)
// - All cache:* keys via SCAN (includes passes, per-user caches, etc.)
//
// Does NOT clear: rate limits, OTP state, admin tokens, ID counters
// ═══════════════════════════════════════════════════════════════════

export async function clearAllCachesOnStartup(): Promise<void> {
  const client = redisService.redisConnection;
  if (!client) {
    logger.warn("Redis connection not available, skipping cache clear");
    return;
  }

  try {
    logger.info("Clearing all application caches on startup...");

    // 1. Bump schedule cache version (orphans all schedule:* variant keys)
    const scheduleVer = await client.incr(SCHEDULE_CACHE_VERSION_KEY);
    logger.info(`Schedule cache version bumped to ${scheduleVer}`);

    // 2. Bump events cache version (orphans all events:* variant keys)
    const eventsVer = await client.incr(EVENTS_CACHE_VERSION_KEY);
    logger.info(`Events cache version bumped to ${eventsVer}`);

    // 3. Scan and delete all cache:* keys (includes passes, per-user caches, etc.)
    let cursor = "0";
    let totalDeleted = 0;

    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        "MATCH",
        "cache:*",
        "COUNT",
        "100"
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        await client.del(...keys);
        totalDeleted += keys.length;
      }
    } while (cursor !== "0");

    logger.info(`Startup cache clear complete`, {
      scheduleVersion: scheduleVer,
      eventsVersion: eventsVer,
      keysDeleted: totalDeleted,
    });
  } catch (err) {
    // Log but don't fail server startup if cache clear fails
    logger.error("Failed to clear caches on startup", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
