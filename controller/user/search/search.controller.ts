import type { NextFunction, Request, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import { PurchaseModel } from "@root/databaseManagers/mongoose/index.js";
import type { SearchUsersQueryType } from "@schemas/user/search.schema.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@utils/helper/auth.types.helper.js";

/**
 * GET /users/search?q=<query>&limit=<limit>
 * 
 * Search for PAID users by name or email.
 * Only returns users who:
 * - Have completed profile (have firstName)
 * - Have at least one purchase (paid pass)
 * 
 * Frontend should debounce this (300ms recommended)
 */
const searchUsers = catchAsync(
  async (
    req: Request & { validatedQuery?: SearchUsersQueryType },
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const authReq = req as AuthenticatedUserRequestWithVerifiedEmail;
    const currentUserId = authReq.user.id;
    
    const { q, limit = 10 } = req.validatedQuery ?? { q: "" };
    const searchQuery = q.trim().toLowerCase();

    // 1. Get all paid user IDs from purchases
    const paidUserIds = await PurchaseModel.distinct("userId");

    // 2. Search users who are paid and match query
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUserId } },        // Exclude current user
          { id: { in: paidUserIds } },           // Only paid users
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
      data: users,
      count: users.length,
    });
  },
);

export { searchUsers };
