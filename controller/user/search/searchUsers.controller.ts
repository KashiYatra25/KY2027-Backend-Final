import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import type { SearchUsersRequestSchemaType } from "@schemas/user/search.schema.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";

/**
 * GET /user/search?searchQuery=<query>&limit=<limit>
 *
 * Search for users by name or email.
 * Returns users who have completed profile (have firstName).
 * Includes isPaidUser field so frontend can show badge for unpaid users.
 * Results are sorted with paid users first.
 *
 * Frontend should debounce this (300ms recommended)
 */
const searchUsers = catchAsync(
  async (
    req: VerifiedRequest<
      { query: SearchUsersRequestSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { id: currentUserId } = req.user;
    const { searchQuery, limit = 10 } = req.validatedQuery;

    // Search users who match query (both paid and unpaid, let frontend show badge)
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUserId } }, // Exclude current user
          { firstName: { not: null } }, // Only completed profiles
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
        isPaidUser: true,
      },
      orderBy: [{ isPaidUser: "desc" }, { firstName: "asc" }, { lastName: "asc" }], // Paid users first
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Users found",
      users,
      count: users.length,
    });
  },
);

export { searchUsers };
