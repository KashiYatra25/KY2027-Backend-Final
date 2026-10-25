import type { NextFunction, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import {
  EventRegistrationModel,
  TeamModel,
} from "@root/databaseManagers/mongoose/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";

/**
 * GET /user/registrations
 * Get all event registrations for the current user
 */
const getMyRegistrations = catchAsync(
  async (
    req: AuthenticatedUserRequestWithVerifiedEmail,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const userId = req.user.id;

    // Get user's teams
    const userTeams = await TeamModel.find({
      "members.userId": userId,
    })
      .select("teamId")
      .lean();
    const userTeamIds = userTeams.map((t) => t.teamId);

    // Find all registrations (individual or via teams)
    const registrations = await EventRegistrationModel.find({
      $or: [{ userId }, { teamId: { $in: userTeamIds } }],
    }).lean();

    // Get event details for all registrations
    const eventSlugs = [...new Set(registrations.map((r) => r.eventSlug))];
    const events = await prisma.event.findMany({
      where: { slug: { in: eventSlugs } },
      select: {
        slug: true,
        name: true,
        tagline: true,
        category: true,
        participationType: true,
        imageUrl: true,
        startsAt: true,
        venue: true,
      },
    });
    const eventMap = new Map(events.map((e) => [e.slug, e]));

    // Get team details for team registrations
    const teamIds = registrations
      .filter((r) => r.teamId)
      .map((r) => r.teamId as string);
    const teams = await TeamModel.find({ teamId: { $in: teamIds } }).lean();
    const teamMap = new Map(teams.map((t) => [t.teamId, t]));

    const registrationsWithDetails = registrations.map((reg) => {
      const event = eventMap.get(reg.eventSlug);
      const team = reg.teamId ? teamMap.get(reg.teamId) : null;

      return {
        registrationId: reg._id,
        eventSlug: reg.eventSlug,
        event: event ?? null,
        participationType: reg.participationType,
        status: reg.status,
        team: team
          ? {
              teamId: team.teamId,
              name: team.name,
              memberCount: team.members.length,
            }
          : null,
        registeredAt: reg.createdAt,
      };
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Registrations fetched successfully",
      registrations: registrationsWithDetails,
      count: registrationsWithDetails.length,
    });
  },
);

export { getMyRegistrations };
