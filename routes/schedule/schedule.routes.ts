import {
  getVenues,
  getFestDays,
  getSchedule,
  getVenueSchedule,
} from "@controller/schedule/index.js";
import { Router, type Router as ExpressRouter } from "express";

export const scheduleRouter: ExpressRouter = Router();

// ═══════════════════════════════════════════════════════════════════
// SCHEDULE ROUTES
// All public endpoints - no auth required
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /schedule
 * Get full schedule with all events, venues, and days
 * Optional query params: day, venue, category
 */
scheduleRouter.get("/", getSchedule);

/**
 * GET /schedule/venues
 * Get all venues for the campus map
 */
scheduleRouter.get("/venues", getVenues);

/**
 * GET /schedule/days
 * Get all festival days
 */
scheduleRouter.get("/days", getFestDays);

/**
 * GET /schedule/venue/:venueSlug
 * Get schedule for a specific venue
 */
scheduleRouter.get("/venue/:venueSlug", getVenueSchedule);
