import { Router, type Router as ExpressRouter } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";
import { userRoutesRESTProtectMiddleware } from "@root/middleware/user/protect/index.js";
import { checkUserAccountStatusMiddleware } from "@middleware/user/protect/checkUserStatus.middleware.js";
import { checkWhetherProfileIsCompleteMiddleware } from "@root/middleware/user/profile/checkWhetherProfileIsComplete.middleware.js";
import { checkUserHasPaidMiddleware } from "@middleware/user/payment/checkUserHasPaid.middleware.js";
import {
  publicReadRateLimiterMiddleware,
  eventRegistrationRateLimiterMiddleware,
} from "@root/middleware/limiters/index.js";
import {
  getEvents,
  getEventBySlug,
  registerForEvent,
  cancelRegistration,
} from "@controller/user/event/index.js";
import {
  getEventsQueryRequestSchema,
  eventSlugParamRequestSchema,
  registerForEventRequestSchema,
} from "@schemas/event/event.schema.js";

export const eventRouter: ExpressRouter = Router();

// ═══════════════════════════════════════════════════════════════════
// PUBLIC ROUTES (no auth required)
// ═══════════════════════════════════════════════════════════════════

eventRouter.get(
  "/",
  publicReadRateLimiterMiddleware,
  RequestGuardMiddleware({ query: getEventsQueryRequestSchema }),
  getEvents,
);

eventRouter.get(
  "/:slug",
  publicReadRateLimiterMiddleware,
  RequestGuardMiddleware({ params: eventSlugParamRequestSchema }),
  getEventBySlug,
);

// ═══════════════════════════════════════════════════════════════════
// PROTECTED ROUTES
// All routes below require:
// 1. Valid NextAuth session (userRoutesRESTProtectMiddleware)
// 2. Active account status (checkUserAccountStatusMiddleware) - SEC-006 FIX
// ═══════════════════════════════════════════════════════════════════

eventRouter.use(userRoutesRESTProtectMiddleware);
eventRouter.use(checkUserAccountStatusMiddleware); // SEC-006: Block suspended users

// Register for event
// Middleware checks: auth -> account status -> profile complete -> user paid -> validate body -> controller
eventRouter.post(
  "/:slug/register",
  eventRegistrationRateLimiterMiddleware,
  checkWhetherProfileIsCompleteMiddleware,
  checkUserHasPaidMiddleware,
  RequestGuardMiddleware({
    params: eventSlugParamRequestSchema,
    body: registerForEventRequestSchema,
  }),
  registerForEvent,
);

// Cancel registration for event
// Only the user (individual) or team creator (team) can cancel
eventRouter.delete(
  "/:slug/registration",
  eventRegistrationRateLimiterMiddleware,
  RequestGuardMiddleware({
    params: eventSlugParamRequestSchema,
  }),
  cancelRegistration,
);
