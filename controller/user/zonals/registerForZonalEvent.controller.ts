import type { Response } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest } from "zodex-axon/errors";
import { ZonalUserCollegeModel } from "@root/databaseManagers/mongoose/zonals/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import type { ZonalEventParamsRequestSchemaType } from "@schemas/zonals/zonals.schema.js";

// ═══════════════════════════════════════════════════════════════════
// REGISTER FOR ZONAL EVENT - ATOMIC VERSION
// 
// Uses atomic findOneAndUpdate to prevent TOCTOU race conditions.
// A user with SINGLE_EVENT pass can only register for 1 event.
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /zonals/:collegeSlug/events/:eventSlug/register
 * 
 * Atomic registration that enforces event limits in the query itself.
 * Prevents race condition where two concurrent requests could both pass
 * the middleware check and register, exceeding the limit.
 */
export const registerForZonalEvent = catchAsync(
  async (
    req: VerifiedRequest<
      { params: ZonalEventParamsRequestSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
  ): Promise<void> => {
    const { collegeSlug, eventSlug } = req.validatedParams;
    const userId = req.user.id;

    // Atomic update with constraints:
    // 1. Not already registered for this event
    // 2. Either unlimited (-1) OR under the limit
    const result = await ZonalUserCollegeModel.findOneAndUpdate(
      { 
        userId, 
        collegeSlug,
        eventLimit: { $ne: 0 }, // Has a valid pass
        registeredEvents: { $ne: eventSlug }, // Not already registered
        $or: [
          { eventLimit: -1 }, // Unlimited pass
          { $expr: { $lt: [{ $size: "$registeredEvents" }, "$eventLimit"] } } // Under limit
        ]
      },
      { $addToSet: { registeredEvents: eventSlug } },
      { new: true }
    );

    if (!result) {
      // Could be: no pass, already registered, or limit exceeded
      // Check which case to give appropriate error
      const doc = await ZonalUserCollegeModel.findOne({ userId, collegeSlug });
      
      if (!doc || doc.eventLimit === 0) {
        new BadRequest().handleResponse(res, {
          info: `No valid pass for ${collegeSlug}. Please purchase a pass first.`,
        });
        return;
      }
      
      if (doc.registeredEvents.includes(eventSlug)) {
        new BadRequest().handleResponse(res, {
          info: "You are already registered for this event.",
        });
        return;
      }
      
      if (doc.eventLimit !== -1 && doc.registeredEvents.length >= doc.eventLimit) {
        new BadRequest().handleResponse(res, {
          info: "Event limit reached. Purchase a multi-event pass for unlimited registrations.",
        });
        return;
      }
      
      // Unexpected case
      new BadRequest().handleResponse(res, {
        info: "Unable to register. Please try again.",
      });
      return;
    }

    new OkResponseStrategy().handleResponse(res, {
      info: "Successfully registered for event",
      collegeSlug,
      eventSlug,
      registeredCount: result.registeredEvents.length,
      eventLimit: result.eventLimit,
    });
  }
);
