import type { NextFunction, Request, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound, BadRequest } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import { EventRegistrationModel, TeamModel } from "@root/databaseManagers/mongoose/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@utils/helper/auth.types.helper.js";
import type {
  GetEventsQueryType,
  RegisterForEventType,
} from "@root/controller/middleware/schemas/event/event.schema.js";

/**
 * GET /user/registrations
 * Get all event registrations for the current user
 */
const getMyRegistrations = catchAsync(
  async (
    req: Request,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const authReq = req as AuthenticatedUserRequestWithVerifiedEmail;
    const userId = authReq.user.id;

    // Get user's teams
    const userTeams = await TeamModel.find({
      "members.userId": userId,
    }).select("teamId").lean();
    const userTeamIds = userTeams.map((t) => t.teamId);

    // Find all registrations (individual or via teams)
    const registrations = await EventRegistrationModel.find({
      $or: [
        { userId },
        { teamId: { $in: userTeamIds } },
      ],
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
    const teamIds = registrations.filter((r) => r.teamId).map((r) => r.teamId as string);
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
        team: team ? {
          teamId: team.teamId,
          name: team.name,
          memberCount: team.members.length,
        } : null,
        registeredAt: reg.createdAt,
      };
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Registrations fetched successfully",
      data: registrationsWithDetails,
      count: registrationsWithDetails.length,
    });
  },
);

/**
 * GET /events
 * List all events with optional filters
 */
const getEvents = catchAsync(
  async (
    req: Request & { validatedQuery?: GetEventsQueryType },
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { category, participationType, registrationOpen } = req.validatedQuery ?? {};

    const where: Record<string, unknown> = {};
    
    if (category) {
      where.category = category;
    }
    if (participationType) {
      where.participationType = participationType;
    }
    if (registrationOpen !== undefined) {
      where.registrationOpen = registrationOpen;
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: [
        { category: "asc" },
        { name: "asc" },
      ],
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        description: true,
        category: true,
        participationType: true,
        minTeamSize: true,
        maxTeamSize: true,
        registrationOpen: true,
        imageUrl: true,
        prizePool: true,
      },
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Events fetched successfully",
      data: events,
    });
  },
);

/**
 * GET /events/:slug
 * Get single event details by slug
 */
const getEventBySlug = catchAsync(
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const slug = req.params.slug as string;

    const event = await prisma.event.findUnique({
      where: { slug },
    });

    if (!event) {
      return next(
        new NotFound().handleResponse(res, {
          info: "Event not found",
        }),
      );
    }

    new OkResponseStrategy().handleResponse(res, {
      info: "Event fetched successfully",
      data: event,
    });
  },
);

/**
 * POST /events/:slug/register
 * Register for an event
 * - INDIVIDUAL: type="individual"
 * - DUO/TEAM: type="team" with teamId
 */
const registerForEvent = catchAsync(
  async (
    req: Request & { validatedData?: RegisterForEventType },
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const authReq = req as AuthenticatedUserRequestWithVerifiedEmail;
    const slug = req.params.slug as string;
    const { id: userId } = authReq.user;
    const body = req.validatedData!;

    // 1. Check event exists and registration is open
    const event = await prisma.event.findUnique({
      where: { slug },
    });

    if (!event) {
      return next(
        new NotFound().handleResponse(res, {
          info: "Event not found",
        }),
      );
    }

    if (!event.registrationOpen) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Registration is closed for this event",
        }),
      );
    }

    // 2. Handle based on request type (discriminated union)
    if (body.type === "individual") {
      // Validate event allows individual participation
      if (event.participationType !== "INDIVIDUAL") {
        return next(
          new BadRequest().handleResponse(res, {
            info: `This is a ${event.participationType.toLowerCase()} event. Please register with a team.`,
          }),
        );
      }

      // Check if user has paid (isPaidUser = true)
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isPaidUser: true },
      });
      if (!user?.isPaidUser) {
        return next(
          new BadRequest().handleResponse(res, {
            info: "You must purchase a pass before registering for events",
          }),
        );
      }

      // Check if already registered
      const existingRegistration = await EventRegistrationModel.findOne({
        eventSlug: slug,
        userId,
      });

      if (existingRegistration) {
        return next(
          new BadRequest().handleResponse(res, {
            info: "You are already registered for this event",
          }),
        );
      }

      // Create registration
      const registration = await EventRegistrationModel.create({
        eventSlug: slug,
        participationType: "individual",
        userId,
        status: "confirmed",
      });

      new OkResponseStrategy().handleResponse(res, {
        info: "Successfully registered for event",
        data: {
          registrationId: registration._id,
          eventSlug: event.slug,
          eventName: event.name,
          status: registration.status,
        },
      });
    } else {
      // body.type === "team"
      // Validate event allows team/duo participation
      if (event.participationType === "INDIVIDUAL") {
        return next(
          new BadRequest().handleResponse(res, {
            info: "This is an individual event. Please register without a team.",
          }),
        );
      }

      const teamId = body.teamId;

      // 1. Find team
      const team = await TeamModel.findOne({ teamId });
      if (!team) {
        return next(
          new NotFound().handleResponse(res, {
            info: "Team not found",
          }),
        );
      }

      // 2. Check user is in team
      const userInTeam = team.members.some((m) => m.userId === userId);
      if (!userInTeam) {
        return next(
          new BadRequest().handleResponse(res, {
            info: "You are not a member of this team",
          }),
        );
      }

      // 3. Check team size fits event requirements
      const teamSize = team.members.length;
      const minSize = event.minTeamSize ?? 1;
      const maxSize = event.maxTeamSize ?? 100;

      // DUO must be exactly 2
      if (event.participationType === "DUO" && teamSize !== 2) {
        return next(
          new BadRequest().handleResponse(res, {
            info: `This is a duo event. Team must have exactly 2 members, but has ${teamSize}.`,
          }),
        );
      }

      // TEAM must be within range
      if (event.participationType === "TEAM") {
        if (teamSize < minSize || teamSize > maxSize) {
          return next(
            new BadRequest().handleResponse(res, {
              info: `Team size must be between ${minSize} and ${maxSize}, but has ${teamSize} members.`,
            }),
          );
        }
      }

      // 4. Check team not already registered for this event
      const existingTeamReg = await EventRegistrationModel.findOne({
        eventSlug: slug,
        teamId,
      });

      if (existingTeamReg) {
        return next(
          new BadRequest().handleResponse(res, {
            info: "This team is already registered for this event",
          }),
        );
      }

      // 5. Check no team member is already registered (individually or via another team)
      const memberIds = team.members.map((m) => m.userId);
      
      // Get all team IDs that these members belong to
      const memberTeamIds = await getTeamIdsForUsers(memberIds);
      
      const existingMemberRegs = await EventRegistrationModel.find({
        eventSlug: slug,
        $or: [
          { userId: { $in: memberIds } },
          { teamId: { $in: memberTeamIds } },
        ],
      });

      if (existingMemberRegs.length > 0) {
        // Find which members are already registered
        const regUserIds = existingMemberRegs
          .filter((r) => r.userId)
          .map((r) => r.userId as string);
        
        const regTeamIds = existingMemberRegs
          .filter((r) => r.teamId)
          .map((r) => r.teamId as string);

        // Get members who are in those teams
        const conflictingTeams = await TeamModel.find({ 
          teamId: { $in: regTeamIds } 
        }).lean();
        const teamMemberIds = conflictingTeams.flatMap((t) => 
          t.members.map((m) => m.userId)
        );

        const conflictingMemberIds = [...new Set([...regUserIds, ...teamMemberIds])]
          .filter((id) => memberIds.includes(id));

        return next(
          new BadRequest().handleResponse(res, {
            info: "Some team members are already registered for this event",
            data: { conflictingMemberIds },
          }),
        );
      }

      // 6. Create registration
      const participationType = event.participationType === "DUO" ? "duo" : "team";
      const registration = await EventRegistrationModel.create({
        eventSlug: slug,
        participationType,
        teamId,
        status: "confirmed",
      });

      new OkResponseStrategy().handleResponse(res, {
        info: "Team successfully registered for event",
        data: {
          registrationId: registration._id,
          eventSlug: event.slug,
          eventName: event.name,
          teamId: team.teamId,
          teamName: team.name,
          memberCount: teamSize,
          status: registration.status,
        },
      });
    }
  },
);

/**
 * Get all team IDs that any of the given users belong to
 */
async function getTeamIdsForUsers(userIds: string[]): Promise<string[]> {
  const teams = await TeamModel.find({
    "members.userId": { $in: userIds },
  }).select("teamId").lean();
  return teams.map((t) => t.teamId);
}

export { getEvents, getEventBySlug, registerForEvent, getMyRegistrations };
