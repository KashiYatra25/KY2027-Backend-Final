import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import { TeamModel } from "@root/databaseManagers/mongoose/index.js";
import { randomUUID } from "crypto";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@utils/helper/auth.types.helper.js";
import type { CreateTeamType } from "@schemas/team/team.schema.js";

/**
 * POST /teams
 * Create a new team with members (no invites - direct add)
 * 
 * All members must:
 * - Exist in database
 * - Have completed profile
 * - Have paid pass
 * 
 * Note: Profile and paid checks are done via middleware
 */
const createTeam = catchAsync(
  async (
    req: VerifiedRequest<{ body: CreateTeamType }, AuthenticatedUserRequestWithVerifiedEmail>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { id: creatorId } = req.user;
    const { name, members: memberIds } = req.validatedData;

    // 1. Check team name is unique
    const existingTeam = await TeamModel.findOne({ name });
    if (existingTeam) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Team name already taken",
        }),
      );
    }

    // 2. Creator cannot be in members list
    if (memberIds.includes(creatorId)) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "You cannot add yourself as a member - you are already the creator",
        }),
      );
    }

    // 3. Check all members exist
    const allMemberIds = [creatorId, ...memberIds];
    const users = await prisma.user.findMany({
      where: { id: { in: allMemberIds } },
      select: { id: true, firstName: true, email: true, isPaidUser: true },
    });

    if (users.length !== allMemberIds.length) {
      const foundIds = users.map((u) => u.id);
      const missingIds = allMemberIds.filter((id) => !foundIds.includes(id));
      return next(
        new BadRequest().handleResponse(res, {
          info: "Some members not found",
          missingIds,
        }),
      );
    }

    // 4. Check all have completed profile (have firstName)
    const incompleteProfiles = users.filter((u) => !u.firstName);
    if (incompleteProfiles.length > 0) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Some members have not completed their profile",
          incomplete: incompleteProfiles.map((u) => u.email),
        }),
      );
    }

    // 5. Check all members have paid (isPaidUser = true)
    const unpaidUsers = users.filter((u) => !u.isPaidUser);
    if (unpaidUsers.length > 0) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Some members have not purchased a pass",
          unpaid: unpaidUsers.map((u) => u.email),
        }),
      );
    }

    // 6. Create team
    const teamId = `TEAM-${randomUUID().slice(0, 8).toUpperCase()}`;
    
    const team = await TeamModel.create({
      teamId,
      name,
      createdBy: creatorId,
      members: allMemberIds.map((userId) => ({
        userId,
        status: "accepted", // No invites - all auto-accepted
        respondedAt: new Date(),
      })),
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Team created successfully",
      teamId: team.teamId,
      name: team.name,
      memberCount: team.members.length,
      members: team.members.map((m) => {
        const user = users.find((u) => u.id === m.userId);
        return {
          userId: m.userId,
          name: user?.firstName,
          email: user?.email,
        };
      }),
    });
  },
);

/**
 * GET /teams/my
 * Get all teams the current user is part of
 */
const getMyTeams = catchAsync(
  async (
    req: VerifiedRequest<Record<string, never>, AuthenticatedUserRequestWithVerifiedEmail>,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { id: userId } = req.user;

    const teams = await TeamModel.find({
      "members.userId": userId,
    }).lean();

    // Get all member details
    const allMemberIds = [...new Set(teams.flatMap((t) => t.members.map((m) => m.userId)))];
    const users = await prisma.user.findMany({
      where: { id: { in: allMemberIds } },
      select: { id: true, firstName: true, lastName: true, email: true, googleAvatarUrl: true, candidatePhotoUrl: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const teamsWithDetails = teams.map((team) => ({
      teamId: team.teamId,
      name: team.name,
      createdBy: team.createdBy,
      isCreator: team.createdBy === userId,
      memberCount: team.members.length,
      members: team.members.map((m) => {
        const user = userMap.get(m.userId);
        return {
          userId: m.userId,
          firstName: user?.firstName,
          lastName: user?.lastName,
          email: user?.email,
          googleAvatarUrl: user?.googleAvatarUrl,
          candidatePhotoUrl: user?.candidatePhotoUrl,
          isYou: m.userId === userId,
        };
      }),
      createdAt: team.createdAt,
    }));

    new OkResponseStrategy().handleResponse(res, {
      info: "Teams fetched successfully",
      teams: teamsWithDetails,
      count: teamsWithDetails.length,
    });
  },
);

export { createTeam, getMyTeams };
