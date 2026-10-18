import type { NextFunction, Request, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound, BadRequest, ForbiddenErrorResponse } from "zodex-axon/errors";
import {
  EventRegistrationModel,
  TeamModel,
} from "@root/databaseManagers/mongoose/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";

/**
 * DELETE /events/:slug/registration
 * Cancel a registration for an event
 * 
 * - Individual: User can cancel their own registration
 * - Team: Only team creator can cancel the team's registration
 */
const cancelRegistration = catchAsync(
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const authReq = req as AuthenticatedUserRequestWithVerifiedEmail;
    const slug = req.params.slug as string;
    const { id: userId } = authReq.user;

    console.log("Cancel registration request:", { slug, userId });

    // 1. Find user's individual registration for this event
    let registration = await EventRegistrationModel.findOne({
      eventSlug: slug,
      userId,
    });

    console.log("Found individual registration:", registration?._id);

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

    console.log("User teams:", userTeams);

    const userTeamIds = userTeams.map((t) => t.teamId);

    // Find team registration for this event
    registration = await EventRegistrationModel.findOne({
      eventSlug: slug,
      teamId: { $in: userTeamIds },
    });

    console.log("Found team registration:", registration?._id);

    if (!registration) {
      // Debug: Find any registration for this slug
      const anyReg = await EventRegistrationModel.findOne({ eventSlug: slug });
      console.log("Any registration for this slug:", anyReg ? { userId: anyReg.userId, teamId: anyReg.teamId } : null);
      
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
