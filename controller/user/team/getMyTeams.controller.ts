import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import { TeamModel } from "@root/databaseManagers/mongoose/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";

/**
 * GET /teams/my
 * Get all teams the current user is part of
 */
const getMyTeams = catchAsync(
  async (
    req: VerifiedRequest<
      Record<string, never>,
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { id: userId } = req.user;

    const teams = await TeamModel.find({
      "members.userId": userId,
    }).lean();

    // Get all member details
    const allMemberIds = [
      ...new Set(teams.flatMap((t) => t.members.map((m) => m.userId))),
    ];
    const users = await prisma.user.findMany({
      where: { id: { in: allMemberIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        googleAvatarUrl: true,
        candidatePhotoUrl: true,
      },
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

export { getMyTeams };
