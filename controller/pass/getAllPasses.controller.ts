import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { PassModel } from "@root/databaseManagers/mongoose/index.js";
import { getCached, setCached, logCacheHit } from "@redis/entityCache.service.js";
import { PASSES_CACHE_KEY } from "@redis/keys/redis.keys.js";
import { SCHEDULE_CACHE_TTL } from "@redis/ttls/ttl.constants.js";

/** Cached payload for the passes list (lean Mongo docs + count). */
interface CachedPasses {
  passes: unknown[];
  count: number;
}

/**
 * GET /pass
 * Fetch all active passes sorted by sortOrder.
 * Public endpoint - no auth required.
 *
 * Read-through cached: passes are a single global dataset that only changes
 * via the offline seed script, so we cache the full response under one global
 * key with a TTL backstop. Redis-down degrades transparently to the DB.
 */
const getAllPasses = catchAsync(
  async (_req: Request, res: Response, _next: NextFunction) => {
    // 1) Try cache first.
    const cached = await getCached<CachedPasses>(PASSES_CACHE_KEY);
    if (cached) {
      logCacheHit("passes");
      new OkResponseStrategy().handleResponse(res, {
        info: "Passes fetched successfully",
        passes: cached.passes,
        count: cached.count,
      });
      return;
    }

    // 2) Miss → query DB.
    const passes = await PassModel.find({ active: true })
      .sort({ sortOrder: 1 })
      .select("-__v")
      .lean();

    // 3) Populate cache (never throws; no-op if Redis is down).
    await setCached(PASSES_CACHE_KEY, { passes, count: passes.length }, SCHEDULE_CACHE_TTL);

    new OkResponseStrategy().handleResponse(res, {
      info: "Passes fetched successfully",
      passes,
      count: passes.length,
    });
  }
);

export { getAllPasses };
