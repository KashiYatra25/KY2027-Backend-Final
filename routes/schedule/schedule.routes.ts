import {
  getVenues,
  getFestDays,
  getSchedule,
  getVenueSchedule,
} from "@controller/schedule/index.js";
import { publicReadRateLimiterMiddleware } from "@middleware/limiters/index.js";
import { venueSlugParamSchema } from "@schemas/schedule/schedule.schema.js";
import { scheduleCacheReadMiddleware } from "@middleware/schedule/scheduleCacheRead.middleware.js";
import {
  getScheduleCacheKey,
  getScheduleVenuesCacheKey,
  getScheduleFestDaysCacheKey,
  getVenueScheduleCacheKey,
} from "@redis/keys/redis.keys.js";
import { Router, type Router as ExpressRouter } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";

export const scheduleRouter: ExpressRouter = Router();

// ═══════════════════════════════════════════════════════════════════
// SCHEDULE ROUTES
// All public endpoints - no auth required
// Rate limited via publicReadRateLimiterMiddleware
// Read-through cached (version-counter invalidated on admin writes)
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /schedule
 * Get full schedule with all events, venues, and days
 * Optional query params: day, venue, category
 */
scheduleRouter.get(
  "/",
  publicReadRateLimiterMiddleware,
  scheduleCacheReadMiddleware((version, req) => {
    // Variant encodes the optional filters so each filter combo caches separately.
    const day = (req.query.day as string) ?? "";
    const venue = ((req.query.venue as string) ?? "").toLowerCase();
    const category = ((req.query.category as string) ?? "").toUpperCase();
    return getScheduleCacheKey(version, `d=${day}&v=${venue}&c=${category}`);
  }, "schedule"),
  getSchedule,
);

/**
 * GET /schedule/venues
 * Get all venues for the campus map
 */
scheduleRouter.get(
  "/venues",
  publicReadRateLimiterMiddleware,
  scheduleCacheReadMiddleware((version) => getScheduleVenuesCacheKey(version), "schedule:venues"),
  getVenues,
);

/**
 * GET /schedule/days
 * Get all festival days
 */
scheduleRouter.get(
  "/days",
  publicReadRateLimiterMiddleware,
  scheduleCacheReadMiddleware((version) => getScheduleFestDaysCacheKey(version), "schedule:days"),
  getFestDays,
);

/**
 * GET /schedule/venue/:venueSlug
 * Get schedule for a specific venue
 */
scheduleRouter.get(
  "/venue/:venueSlug",
  publicReadRateLimiterMiddleware,
  RequestGuardMiddleware({ params: venueSlugParamSchema }),
  scheduleCacheReadMiddleware((version, req) =>
    getVenueScheduleCacheKey(version, (req.params.venueSlug as string).toLowerCase()),
    "schedule:venue",
  ),
  getVenueSchedule,
);
