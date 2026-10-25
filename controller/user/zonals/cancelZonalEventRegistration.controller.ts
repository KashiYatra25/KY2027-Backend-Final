import type { Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { ZonalUserCollegeModel } from "@root/databaseManagers/mongoose/zonals/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";

// ═══════════════════════════════════════════════════════════════════
// CANCEL ZONAL EVENT REGISTRATION
// ═══════════════════════════════════════════════════════════════════

/**
 * DELETE /zonals/:collegeSlug/events/:eventSlug/registration
 */
export const cancelZonalEventRegistration = catchAsync(
  async (
    req: AuthenticatedUserRequestWithVerifiedEmail,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const collegeSlug = req.params.collegeSlug as string;
    const eventSlug = req.params.eventSlug as string;
    const userId = req.user.id;

    const doc = await ZonalUserCollegeModel.findOne({ userId, collegeSlug });

    if (!doc) {
      return next(
        new NotFound().handleResponse(res, {
          info: "No pass found for this college",
        })
      );
    }

    if (!doc.registeredEvents.includes(eventSlug)) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "You are not registered for this event",
        })
      );
    }

    await ZonalUserCollegeModel.updateOne(
      { userId, collegeSlug },
      { $pull: { registeredEvents: eventSlug } }
    );

    new OkResponseStrategy().handleResponse(res, {
      info: "Registration cancelled successfully",
      collegeSlug,
      eventSlug,
    });
  }
);
