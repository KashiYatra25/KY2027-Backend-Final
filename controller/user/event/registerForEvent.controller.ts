import type { NextFunction, Request, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound, BadRequest } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import {
  EventRegistrationModel,
  TeamModel,
} from "@root/databaseManagers/mongoose/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import type { RegisterForEventRequestSchemaType } from "@schemas/event/event.schema.js";

/**
 * Get all team IDs that any of the given users belong to
 */
async function getTeamIdsForUsers(userIds: string[]): Promise<string[]> {
  const teams = await TeamModel.find({
    "members.userId": { $in: userIds },
  })
    .select("teamId")
    .lean();
  return teams.map((t) => t.teamId);
}

/**
 * POST /events/:slug/register
 * Register for an event
 * - INDIVIDUAL: type="individual"
 * - DUO/TEAM: type="team" with teamId
 */
const registerForEvent = catchAsync(
  async (
    req: Request & { validatedData?: RegisterForEventRequestSchemaType },
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
        registrationId: registration._id,
        eventSlug: event.slug,
        eventName: event.name,
        status: registration.status,
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

      // 3.5. Check all team members have paid passes
      const memberIds = team.members.map((m) => m.userId);
      const paidMembers = await prisma.user.findMany({
        where: { 
          id: { in: memberIds },
          isPaidUser: true,
        },
        select: { id: true },
      });

      if (paidMembers.length !== memberIds.length) {
        const paidIds = new Set(paidMembers.map((p) => p.id));
        const unpaidMemberIds = memberIds.filter((id) => !paidIds.has(id));
        return next(
          new BadRequest().handleResponse(res, {
            info: "All team members must have purchased a pass before registering for events",
            unpaidMemberCount: unpaidMemberIds.length,
          }),
        );
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
      // Note: memberIds was already extracted in step 3.5

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
          teamId: { $in: regTeamIds },
        }).lean();
        const teamMemberIds = conflictingTeams.flatMap((t) =>
          t.members.map((m) => m.userId),
        );

        const conflictingMemberIds = [
          ...new Set([...regUserIds, ...teamMemberIds]),
        ].filter((id) => memberIds.includes(id));

        return next(
          new BadRequest().handleResponse(res, {
            info: "Some team members are already registered for this event",
            conflictingMemberIds,
          }),
        );
      }

      // 6. Create registration
      const participationType =
        event.participationType === "DUO" ? "duo" : "team";
      const registration = await EventRegistrationModel.create({
        eventSlug: slug,
        participationType,
        teamId,
        status: "confirmed",
      });

      new OkResponseStrategy().handleResponse(res, {
        info: "Team successfully registered for event",
        registrationId: registration._id,
        eventSlug: event.slug,
        eventName: event.name,
        teamId: team.teamId,
        teamName: team.name,
        memberCount: teamSize,
        status: registration.status,
      });
    }
  },
);

export { registerForEvent };
