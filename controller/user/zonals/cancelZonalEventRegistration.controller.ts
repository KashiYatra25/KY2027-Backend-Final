import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { ZonalUserCollegeModel } from "@root/databaseManagers/mongoose/zonals/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import type { ZonalEventParamsRequestSchemaType } from "@schemas/zonals/zonals.schema.js";

// ═══════════════════════════════════════════════════════════════════
// CANCEL ZONAL EVENT REGISTRATION
// ═══════════════════════════════════════════════════════════════════

/**
 * DELETE /zonals/:collegeSlug/events/:eventSlug/registration
 */
export const cancelZonalEventRegistration = catchAsync(
  async (
    req: VerifiedRequest<
      { params: ZonalEventParamsRequestSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { collegeSlug, eventSlug } = req.validatedParams;
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
