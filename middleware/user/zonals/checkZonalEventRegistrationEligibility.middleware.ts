import type { Request, Response, NextFunction } from "express";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { catchAsync } from "zodex-axon/core";
import { ZonalUserCollegeModel } from "@root/databaseManagers/mongoose/zonals/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";

// ═══════════════════════════════════════════════════════════════════
// ZONAL EVENT REGISTRATION ELIGIBILITY MIDDLEWARE
//
// Checks if user can register for a zonal event:
// 1. Has a document for this college with eventLimit > 0 or -1 (unlimited)
// 2. Not already registered for the event
// 3. Haven't exceeded their limit
// ═══════════════════════════════════════════════════════════════════

export interface ZonalEligibilityRequest extends AuthenticatedUserRequestWithVerifiedEmail {
  zonalData: {
    eventLimit: number; // -1 = unlimited
    registeredEvents: string[];
    collegeSlug: string;
  };
}

/**
 * Middleware to check if user is eligible to register for a zonal event.
 * Expects `collegeSlug` and `eventSlug` in request params.
 */
export const checkZonalEventRegistrationEligibilityMiddleware = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthenticatedUserRequestWithVerifiedEmail;
    const collegeSlug = req.params.collegeSlug as string;
    const eventSlug = req.params.eventSlug as string;
    const userId = authReq.user.id;

    // 1. Find user's document for this college
    const doc = await ZonalUserCollegeModel.findOne({ userId, collegeSlug });

    if (!doc || doc.eventLimit === 0) {
      return next(
        new NotFound().handleResponse(res, {
          info: `No valid pass for ${collegeSlug}. Please purchase a pass first.`,
        })
      );
    }

    // 2. Check if already registered for this event
    if (doc.registeredEvents.includes(eventSlug)) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "You are already registered for this event.",
        })
      );
    }

    // 3. Check limit (-1 = unlimited)
    if (doc.eventLimit !== -1 && doc.registeredEvents.length >= doc.eventLimit) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Event limit reached. Purchase a multi-event pass for unlimited registrations.",
        })
      );
    }

    // Attach data for controller
    (req as unknown as ZonalEligibilityRequest).zonalData = {
      eventLimit: doc.eventLimit,
      registeredEvents: doc.registeredEvents,
      collegeSlug,
    };

    next();
  }
);
