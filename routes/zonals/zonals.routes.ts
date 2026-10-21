import { Router } from "express";
import {
  getZonalColleges,
  getMyZonalPasses,
  registerForZonalEvent,
  cancelZonalEventRegistration,
} from "@root/controller/user/zonals/index.js";
import { userRoutesRESTProtectMiddleware } from "@root/middleware/user/protect/index.js";
import { checkZonalEventRegistrationEligibilityMiddleware } from "@root/middleware/user/zonals/checkZonalEventRegistrationEligibility.middleware.js";

// ═══════════════════════════════════════════════════════════════════
// ZONALS ROUTES
// ═══════════════════════════════════════════════════════════════════

const zonalsRouter = Router();

// ─────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────────────────────────────

// Get all zonal colleges with events and pass info
zonalsRouter.get("/colleges", getZonalColleges);

// ─────────────────────────────────────────────────────────────────────
// PROTECTED ROUTES (require auth)
// ─────────────────────────────────────────────────────────────────────

// Get user's zonal passes
zonalsRouter.get(
  "/my-passes",
  userRoutesRESTProtectMiddleware,
  getMyZonalPasses
);

// Register for a zonal event (with eligibility check)
zonalsRouter.post(
  "/:collegeSlug/events/:eventSlug/register",
  userRoutesRESTProtectMiddleware,
  checkZonalEventRegistrationEligibilityMiddleware,
  registerForZonalEvent
);

// Cancel zonal event registration
zonalsRouter.delete(
  "/:collegeSlug/events/:eventSlug/registration",
  userRoutesRESTProtectMiddleware,
  cancelZonalEventRegistration
);

export default zonalsRouter;
