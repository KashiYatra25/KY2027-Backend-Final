import {
  getVenues,
  getFestDays,
  getSchedule,
  getVenueSchedule,
} from "@controller/schedule/index.js";
import { publicReadRateLimiterMiddleware } from "@middleware/limiters/index.js";
import { venueSlugParamSchema } from "@schemas/schedule/schedule.schema.js";
import { Router, type Router as ExpressRouter } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";

export const scheduleRouter: ExpressRouter = Router();

// ═══════════════════════════════════════════════════════════════════
// SCHEDULE ROUTES
// All public endpoints - no auth required
// Rate limited via publicReadRateLimiterMiddleware
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /schedule
 * Get full schedule with all events, venues, and days
 * Optional query params: day, venue, category
 */
scheduleRouter.get("/", publicReadRateLimiterMiddleware, getSchedule);

/**
 * GET /schedule/venues
 * Get all venues for the campus map
 */
scheduleRouter.get("/venues", publicReadRateLimiterMiddleware, getVenues);

/**
 * GET /schedule/days
 * Get all festival days
 */
scheduleRouter.get("/days", publicReadRateLimiterMiddleware, getFestDays);

/**
 * GET /schedule/venue/:venueSlug
 * Get schedule for a specific venue
 */
scheduleRouter.get(
  "/venue/:venueSlug",
  publicReadRateLimiterMiddleware,
  RequestGuardMiddleware({ params: venueSlugParamSchema }),
  getVenueSchedule,
);
