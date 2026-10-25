import type { Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { logger } from "@logger/logger.js";
import { redisService } from "@redis/index.js";
import { bumpScheduleCacheVersion } from "@redis/scheduleCache.service.js";
import { bumpEventsCacheVersion } from "@redis/eventsCache.service.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// INVALIDATE ALL CACHES
//
// Admin-only endpoint to nuke all application caches. Useful when:
// - Data was seeded/updated directly in the database
// - Something's stale and you need a clean slate
// - Debugging cache-related issues
//
// This does NOT flush the entire Redis DB (preserves rate-limit state,
// admin tokens, OTP state, etc.) — it only clears the entity caches:
// schedule/events via version bump, passes directly, and a SCAN sweep of any
// remaining cache:* keys (e.g. per-user profile/teams/registrations caches).
// ═══════════════════════════════════════════════════════════════════

export const invalidateAllCaches = catchAsync(
  async (_req: AdminRequestWithVerifiedCreds, res: Response) => {
    const results: Record<string, string> = {};

    // 1. Bump schedule cache version (orphans all schedule:* variant keys)
    try {
      await bumpScheduleCacheVersion();
      results.schedule = "version bumped";
    } catch (err) {
      results.schedule = `failed: ${(err as Error).message}`;
    }

    // 2. Bump events cache version (orphans all events:* variant keys)
    try {
      await bumpEventsCacheVersion();
      results.events = "version bumped";
    } catch (err) {
      results.events = `failed: ${(err as Error).message}`;
    }

    // 3. SCAN + delete all remaining cache:* keys (per-user caches, etc.).
    //    redisConnection is an ioredis client: scan returns [nextCursor, keys].
    try {
      const client = redisService.redisConnection;
      if (client) {
        let cursor = "0";
        let deletedCount = 0;
        do {
          const [nextCursor, keys] = (await client.scan(
            cursor,
            "MATCH",
            "cache:*",
            "COUNT",
            100,
          )) as [string, string[]];
          cursor = nextCursor;
          if (keys.length > 0) {
            await client.del(...keys);
            deletedCount += keys.length;
          }
        } while (cursor !== "0");
        results.scanDelete = `${deletedCount} keys deleted`;
      } else {
        results.scanDelete = "skipped (no connection)";
      }
    } catch (err) {
      results.scanDelete = `failed: ${(err as Error).message}`;
    }

    logger.info("Admin: all caches invalidated", { results });

    new OkResponseStrategy().handleResponse(res, {
      info: "All caches invalidated",
      results,
    });
  },
);
