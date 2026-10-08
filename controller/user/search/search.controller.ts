import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import type { SearchUsersQueryType } from "@schemas/user/search.schema.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@utils/helper/auth.types.helper.js";

/**
 * GET /user/search?searchQuery=<query>&limit=<limit>
 * 
 * Search for PAID users by name or email.
 * Only returns users who:
 * - Have completed profile (have firstName)
 * - Have isPaidUser = true (paid pass or IIT BHU)
 * 
 * Frontend should debounce this (300ms recommended)
 */
const searchUsers = catchAsync(
  async (
    req: VerifiedRequest<{ query: SearchUsersQueryType }, AuthenticatedUserRequestWithVerifiedEmail>,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { id: currentUserId } = req.user;
    const { searchQuery, limit = 10 } = req.validatedQuery;

    // Search users who are paid and match query
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUserId } },        // Exclude current user
          { isPaidUser: true },                  // Only paid users
          { firstName: { not: null } },          // Only completed profiles
          {
            OR: [
              { firstName: { contains: searchQuery, mode: "insensitive" } },
              { lastName: { contains: searchQuery, mode: "insensitive" } },
              { email: { contains: searchQuery, mode: "insensitive" } },
              { slugName: { contains: searchQuery, mode: "insensitive" } },
            ],
          },
        ],
      },
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        slugName: true,
        googleAvatarUrl: true,
        candidatePhotoUrl: true,
        college: true,
      },
      orderBy: [
        { firstName: "asc" },
        { lastName: "asc" },
      ],
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Users found",
      users,
      count: users.length,
    });
  },
);

export { searchUsers };
