import type { NextFunction, Request, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import { logCacheHit } from "@redis/entityCache.service.js";
import { getEventBySlugCacheKey } from "@redis/keys/redis.keys.js";
import {
  getEventsVersion,
  getEventsCached,
  setEventsCached,
} from "@redis/eventsCache.service.js";

/**
 * GET /events/:slug
 * Get single event details by slug.
 *
 * Read-through cached (global, version-counter invalidated). Only successful
 * lookups are cached — a 404 is never cached so a newly-added event becomes
 * visible immediately.
 */
const getEventBySlug = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const slug = req.params.slug as string;

    const version = await getEventsVersion();
    const cacheKey = getEventBySlugCacheKey(version, slug);

    // 1) Try cache first.
    const cached = await getEventsCached<{ event: unknown }>(cacheKey);
    if (cached) {
      logCacheHit("event:slug");
      new OkResponseStrategy().handleResponse(res, {
        info: "Event fetched successfully",
        event: cached.event,
      });
      return;
    }

    // 2) Miss → query DB.
    const event = await prisma.event.findUnique({
      where: { slug },
    });

    if (!event) {
      // Do NOT cache misses.
      return next(
        new NotFound().handleResponse(res, {
          info: "Event not found",
        }),
      );
    }

    // 3) Populate cache (never throws; no-op if Redis is down).
    await setEventsCached(cacheKey, { event });

    new OkResponseStrategy().handleResponse(res, {
      info: "Event fetched successfully",
      event,
    });
  },
);

export { getEventBySlug };
