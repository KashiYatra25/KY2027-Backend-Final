import { Router } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";
import {
  getZonalColleges,
  getMyZonalPasses,
  registerForZonalEvent,
  cancelZonalEventRegistration,
} from "@root/controller/user/zonals/index.js";
import { userRoutesRESTProtectMiddleware } from "@root/middleware/user/protect/index.js";
import { checkZonalEventRegistrationEligibilityMiddleware } from "@root/middleware/user/zonals/checkZonalEventRegistrationEligibility.middleware.js";
import {
  publicReadRateLimiterMiddleware,
  eventRegistrationRateLimiterMiddleware,
} from "@root/middleware/limiters/index.js";
import { zonalEventParamsRequestSchema } from "@schemas/zonals/zonals.schema.js";

// ═══════════════════════════════════════════════════════════════════
// ZONALS ROUTES
// ═══════════════════════════════════════════════════════════════════

const zonalsRouter = Router();

// ─────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────────────────────────────

// Get all zonal colleges with events and pass info
zonalsRouter.get("/colleges", publicReadRateLimiterMiddleware, getZonalColleges);

// ─────────────────────────────────────────────────────────────────────
// PROTECTED ROUTES (require auth)
// ─────────────────────────────────────────────────────────────────────

// Get user's zonal passes
zonalsRouter.get(
  "/my-passes",
  publicReadRateLimiterMiddleware,
  userRoutesRESTProtectMiddleware,
  getMyZonalPasses
);

// Register for a zonal event (with eligibility check)
zonalsRouter.post(
  "/:collegeSlug/events/:eventSlug/register",
  eventRegistrationRateLimiterMiddleware,
  userRoutesRESTProtectMiddleware,
  RequestGuardMiddleware({ params: zonalEventParamsRequestSchema }),
  checkZonalEventRegistrationEligibilityMiddleware,
  registerForZonalEvent
);

// Cancel zonal event registration
zonalsRouter.delete(
  "/:collegeSlug/events/:eventSlug/registration",
  eventRegistrationRateLimiterMiddleware,
  userRoutesRESTProtectMiddleware,
  RequestGuardMiddleware({ params: zonalEventParamsRequestSchema }),
  cancelZonalEventRegistration
);

export default zonalsRouter;
