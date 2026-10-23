import type { NextFunction, Request, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import type { GetEventsQueryRequestSchemaType } from "@schemas/event/event.schema.js";
import { logCacheHit } from "@redis/entityCache.service.js";
import { getEventsListCacheKey } from "@redis/keys/redis.keys.js";
import {
  getEventsVersion,
  getEventsCached,
  setEventsCached,
} from "@redis/eventsCache.service.js";

/**
 * GET /events
 * List all events with optional filters.
 *
 * Read-through cached (global, version-counter invalidated). The cache key
 * encodes the query filters so each filter combination is cached separately;
 * all variants are orphaned instantly when the events version is bumped.
 */
const getEvents = catchAsync(
  async (
    req: Request & { validatedQuery?: GetEventsQueryRequestSchemaType },
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { category, participationType, registrationOpen } =
      req.validatedQuery ?? {};

    // Build a deterministic cache variant from the (normalised) filters.
    const variant = [
      `c=${category ?? "*"}`,
      `p=${participationType ?? "*"}`,
      `r=${registrationOpen === undefined ? "*" : registrationOpen}`,
    ].join("|");

    const version = await getEventsVersion();
    const cacheKey = getEventsListCacheKey(version, variant);

    // 1) Try cache first.
    const cached = await getEventsCached<{ events: unknown[] }>(cacheKey);
    if (cached) {
      logCacheHit("events");
      new OkResponseStrategy().handleResponse(res, {
        info: "Events fetched successfully",
        events: cached.events,
      });
      return;
    }

    // 2) Miss → query DB.
    const where: Record<string, unknown> = {};

    if (category) {
      where.category = category;
    }
    if (participationType) {
      where.participationType = participationType;
    }
    if (registrationOpen !== undefined) {
      where.registrationOpen = registrationOpen;
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        description: true,
        category: true,
        participationType: true,
        minTeamSize: true,
        maxTeamSize: true,
        registrationOpen: true,
        imageUrl: true,
        prizePool: true,
      },
    });

    // 3) Populate cache (never throws; no-op if Redis is down).
    await setEventsCached(cacheKey, { events });

    new OkResponseStrategy().handleResponse(res, {
      info: "Events fetched successfully",
      events,
    });
  },
);

export { getEvents };
