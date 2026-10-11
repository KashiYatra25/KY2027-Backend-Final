import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import { TeamModel } from "@root/databaseManagers/mongoose/index.js";
import { randomUUID } from "crypto";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import type { CreateTeamRequestSchemaType } from "@schemas/team/team.schema.js";
import { checkForProfileCompletion } from "@root/controller/helper/index.js";

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
    req: VerifiedRequest<
      { body: CreateTeamRequestSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
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
    const foundUsers = await prisma.user.findMany({
      where: { id: { in: allMemberIds } },
      select: { id: true, firstName: true, email: true, isPaidUser: true },
    });

    if (foundUsers.length !== allMemberIds.length) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Some members not found",
          invalidCount: allMemberIds.length - foundUsers.length,
        }),
      );
    }

    // 4. Check all have completed profile (using MongoDB AccountProgress)
    const profileCheck = await checkForProfileCompletion(
      allMemberIds.map((userId) => ({ userId })),
    );

    if (!profileCheck.isComplete) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Some members have not completed their profile",
          invalidCount: profileCheck.incompleteUsers.length,
        }),
      );
    }

    // 5. Check all members have paid (isPaidUser = true)
    const unpaidUsers = foundUsers.filter((u) => !u.isPaidUser);
    if (unpaidUsers.length > 0) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Some members have not purchased a pass",
          invalidCount: unpaidUsers.length,
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
        const user = foundUsers.find((u) => u.id === m.userId);
        return {
          userId: m.userId,
          name: user?.firstName,
          email: user?.email,
        };
      }),
    });
  },
);

export { createTeam };
