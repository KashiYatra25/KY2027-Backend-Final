import type { Request, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { ZonalUserCollegeModel } from "@root/databaseManagers/mongoose/zonals/index.js";
import type { ZonalEligibilityRequest } from "@root/middleware/user/zonals/checkZonalEventRegistrationEligibility.middleware.js";

// ═══════════════════════════════════════════════════════════════════
// REGISTER FOR ZONAL EVENT
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /zonals/:collegeSlug/events/:eventSlug/register
 */
export const registerForZonalEvent = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const eligReq = req as ZonalEligibilityRequest;
    const collegeSlug = req.params.collegeSlug as string;
    const eventSlug = req.params.eventSlug as string;
    const userId = eligReq.user.id;

    await ZonalUserCollegeModel.updateOne(
      { userId, collegeSlug },
      { $addToSet: { registeredEvents: eventSlug } }
    );

    new OkResponseStrategy().handleResponse(res, {
      info: "Successfully registered for event",
      collegeSlug,
      eventSlug,
    });
  }
);
