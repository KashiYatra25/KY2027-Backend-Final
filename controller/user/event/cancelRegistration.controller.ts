import type { NextFunction, Response } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound, BadRequest, ForbiddenErrorResponse } from "zodex-axon/errors";
import {
  EventRegistrationModel,
  TeamModel,
} from "@root/databaseManagers/mongoose/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import type { EventSlugParamRequestSchemaType } from "@schemas/event/event.schema.js";

/**
 * DELETE /events/:slug/registration
 * Cancel a registration for an event
 * 
 * - Individual: User can cancel their own registration
 * - Team: Only team creator can cancel the team's registration
 */
const cancelRegistration = catchAsync(
  async (
    req: VerifiedRequest<
      { params: EventSlugParamRequestSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { slug } = req.validatedParams;
    const { id: userId } = req.user;

    // 1. Find user's individual registration for this event
    let registration = await EventRegistrationModel.findOne({
      eventSlug: slug,
      userId,
    });

    if (registration) {
      // Individual registration - user can cancel
      if (registration.status === "cancelled") {
        return next(
          new BadRequest().handleResponse(res, {
            info: "This registration is already cancelled",
          }),
        );
      }

      // Cancel the registration
      registration.status = "cancelled";
      await registration.save();

      new OkResponseStrategy().handleResponse(res, {
        info: "Registration cancelled successfully",
        registrationId: registration._id,
        eventSlug: slug,
        type: "individual",
      });
      return;
    }

    // 2. Check for team registration
    // Get all teams where user is a member
    const userTeams = await TeamModel.find({
      "members.userId": userId,
    })
      .select("teamId createdBy")
      .lean();

    const userTeamIds = userTeams.map((t) => t.teamId);

    // Find team registration for this event
    registration = await EventRegistrationModel.findOne({
      eventSlug: slug,
      teamId: { $in: userTeamIds },
    });

    if (!registration) {
      return next(
        new NotFound().handleResponse(res, {
          info: "You are not registered for this event",
        }),
      );
    }

    if (registration.status === "cancelled") {
      return next(
        new BadRequest().handleResponse(res, {
          info: "This registration is already cancelled",
        }),
      );
    }

    // Only team creator can cancel team registration
    const team = userTeams.find((t) => t.teamId === registration!.teamId);
    if (team && team.createdBy !== userId) {
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: "Only the team creator can cancel the team registration",
        }),
      );
    }

    // Cancel the team registration
    registration.status = "cancelled";
    await registration.save();

    new OkResponseStrategy().handleResponse(res, {
      info: "Team registration cancelled successfully",
      registrationId: registration._id,
      eventSlug: slug,
      teamId: registration.teamId,
      type: "team",
    });
  },
);

export { cancelRegistration };
