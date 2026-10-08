import { Router, type Router as ExpressRouter } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";
import { restProtectMiddleware } from "@middleware/protect/protect.route.factory.middleware.js";
import {
  getEvents,
  getEventBySlug,
  registerForEvent,
} from "@controller/user/event/index.js";
import {
  getEventsQuerySchema,
  eventSlugParamSchema,
  registerForEventSchema,
} from "@schemas/event/event.schema.js";

export const eventRouter: ExpressRouter = Router();

// Public routes - no auth required
eventRouter.get(
  "/",
  RequestGuardMiddleware({ query: getEventsQuerySchema }),
  getEvents,
);

eventRouter.get(
  "/:slug",
  RequestGuardMiddleware({ params: eventSlugParamSchema }),
  getEventBySlug,
);

// Protected routes - auth required
eventRouter.use(restProtectMiddleware);

// Register for event
// Profile check not needed - payment requires profile completion first
eventRouter.post(
  "/:slug/register",
  RequestGuardMiddleware({ params: eventSlugParamSchema, body: registerForEventSchema }),
  registerForEvent,
);
