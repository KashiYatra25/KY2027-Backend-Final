import type { Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import { TeamModel } from "@root/databaseManagers/mongoose/index.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

/**
 * Escapes RegExp metacharacters in user-supplied input so it can be safely
 * embedded in a MongoDB `$regex` query. Prevents NoSQL regex injection and
 * ReDoS-style abuse where crafted patterns alter query semantics or cause
 * catastrophic backtracking.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * GET /admin/teams
 * Get all teams with member details
 * 
 * Query params:
 * - page: number (default 1)
 * - limit: number (default 20, max 50)
 * - search: string (search by team name or teamId)
 * 
 * Requires: MASTER_ADMIN or MANAGER role
 */
const getAllTeams = catchAsync(
  async (
    req: AdminRequestWithVerifiedCreds,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string)?.trim() || "";

    // Build query
    const query: Record<string, any> = {};
    if (search) {
      // Escape regex metacharacters to prevent NoSQL regex injection / ReDoS
      const safeSearch = escapeRegex(search);
      query.$or = [
        { name: { $regex: safeSearch, $options: "i" } },
        { teamId: { $regex: safeSearch, $options: "i" } },
      ];
    }

    // Get total count
    const totalCount = await TeamModel.countDocuments(query);

    // Get paginated teams
    const teams = await TeamModel.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Get all unique user IDs from teams
    const allUserIds = [...new Set(teams.flatMap(t => [t.createdBy, ...t.members.map(m => m.userId)]))];

    // Fetch user details from Prisma
    const users = await prisma.user.findMany({
      where: { id: { in: allUserIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        googleAvatarUrl: true,
        candidatePhotoUrl: true,
        college: true,
        isPaidUser: true,
        kyId: true,
      },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    // Transform teams with user details
    const teamsWithDetails = teams.map(team => {
      const creator = userMap.get(team.createdBy);
      return {
        teamId: team.teamId,
        name: team.name,
        createdBy: {
          userId: team.createdBy,
          firstName: creator?.firstName,
          lastName: creator?.lastName,
          email: creator?.email,
          googleAvatarUrl: creator?.googleAvatarUrl,
          candidatePhotoUrl: creator?.candidatePhotoUrl,
          college: creator?.college,
          isPaidUser: creator?.isPaidUser,
          kyId: creator?.kyId,
        },
        memberCount: team.members.length,
        members: team.members.map(m => {
          const user = userMap.get(m.userId);
          return {
            userId: m.userId,
            status: m.status,
            respondedAt: m.respondedAt,
            firstName: user?.firstName,
            lastName: user?.lastName,
            email: user?.email,
            googleAvatarUrl: user?.googleAvatarUrl,
            candidatePhotoUrl: user?.candidatePhotoUrl,
            college: user?.college,
            isPaidUser: user?.isPaidUser,
            kyId: user?.kyId,
          };
        }),
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      };
    });

    const totalPages = Math.ceil(totalCount / limit);

    new OkResponseStrategy().handleResponse(res, {
      info: "Teams fetched successfully",
      teams: teamsWithDetails,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  },
);

export { getAllTeams };
