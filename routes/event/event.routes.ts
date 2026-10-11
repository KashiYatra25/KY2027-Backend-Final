import { Router, type Router as ExpressRouter } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";
import { userRoutesRESTProtectMiddleware } from "@root/middleware/user/protect/index.js";
import {
  publicReadRateLimiter,
  eventRegistrationRateLimiter,
} from "@root/middleware/limiters/index.js";
import {
  getEvents,
  getEventBySlug,
  registerForEvent,
} from "@controller/user/event/index.js";
import {
  getEventsQuerySchema,
  eventSlugParamRequestSchema,
  registerForEventRequestSchema,
} from "@schemas/event/event.schema.js";

export const eventRouter: ExpressRouter = Router();

// Public routes - no auth required
eventRouter.get(
  "/",
  publicReadRateLimiter,
  RequestGuardMiddleware({ query: getEventsQuerySchema }),
  getEvents,
);

eventRouter.get(
  "/:slug",
  publicReadRateLimiter,
  RequestGuardMiddleware({ params: eventSlugParamRequestSchema }),
  getEventBySlug,
);

// Protected routes - auth required
eventRouter.use(userRoutesRESTProtectMiddleware);

// Register for event
// Profile check not needed - payment requires profile completion first
eventRouter.post(
  "/:slug/register",
  eventRegistrationRateLimiter,
  RequestGuardMiddleware({
    params: eventSlugParamRequestSchema,
    body: registerForEventRequestSchema,
  }),
  registerForEvent,
);
