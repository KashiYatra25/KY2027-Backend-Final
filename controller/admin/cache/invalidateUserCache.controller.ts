import type { Request, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest } from "zodex-axon/errors";
import { logger } from "@logger/logger.js";
import { redisService } from "@redis/index.js";
import {
  getMyAccountCacheKey,
  getMyTeamsCacheKey,
  getMyRegistrationsCacheKey,
} from "@redis/keys/redis.keys.js";

// ═══════════════════════════════════════════════════════════════════
// INVALIDATE USER CACHE
//
// MASTER_ADMIN only endpoint to clear all cached data for a specific user.
// Useful when:
// - User reports stale data
// - Admin manually updated user data in DB
// - Debugging user-specific cache issues
//
// Clears:
// - myAccount cache (profile + progress)
// - teams cache
// - registrations cache
// ═══════════════════════════════════════════════════════════════════

export const invalidateUserCache = catchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.body as { userId?: string };

    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      new BadRequest().handleResponse(res, {
        info: "userId is required",
      });
      return;
    }

    const results: Record<string, boolean> = {};
    const client = redisService.redisConnection;

    if (!client) {
      new BadRequest().handleResponse(res, {
        info: "Redis connection not available",
      });
      return;
    }

    // Get all user-specific cache keys
    const keysToDelete = [
      { name: "myAccount", key: getMyAccountCacheKey(userId) },
      { name: "teams", key: getMyTeamsCacheKey(userId) },
      { name: "registrations", key: getMyRegistrationsCacheKey(userId) },
    ];

    // Delete each key
    for (const { name, key } of keysToDelete) {
      try {
        const deleted = await client.del(key);
        results[name] = deleted > 0;
      } catch (err) {
        logger.error("Failed to delete cache key", {
          key,
          error: (err as Error).message,
        });
        results[name] = false;
      }
    }

    logger.info("Admin: user cache invalidated", {
      userId,
      results,
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "User cache invalidated",
      userId,
      results,
    });
  }
);
