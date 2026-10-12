import type { Response, NextFunction, Request } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";

/**
 * GET /ca/leaderboard
 * Get CAs with pagination and sorting
 * Public endpoint - no auth required
 *
 * Query params:
 * - page: page number (default 1)
 * - limit: results per page (default 10, max 50)
 * - sortBy: field to sort by (referrals | name | college) - default referrals
 * - sortOrder: asc | desc - default desc
 */
export const getCaLeaderboard = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 50);
    const sortBy = (req.query.sortBy as string) || "referrals";
    const sortOrder = (req.query.sortOrder as string) === "asc" ? "asc" : "desc";

    const skip = (page - 1) * limit;

    // Build orderBy based on sortBy parameter
    type OrderByType = {
      numberOfReferrals?: "asc" | "desc";
      user?: { firstName?: "asc" | "desc"; college?: "asc" | "desc" };
    };
    let orderBy: OrderByType;
    switch (sortBy) {
      case "name":
        orderBy = { user: { firstName: sortOrder } };
        break;
      case "college":
        orderBy = { user: { college: sortOrder } };
        break;
      case "referrals":
      default:
        orderBy = { numberOfReferrals: sortOrder };
        break;
    }

    // Get total count for pagination
    const totalCount = await prisma.caProfile.count();

    // Fetch paginated data with current sort
    const leaderboard = await prisma.caProfile.findMany({
      orderBy,
      skip,
      take: limit,
      select: {
        id: true,
        referralId: true,
        numberOfReferrals: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            slugName: true,
            googleAvatarUrl: true,
            candidatePhotoUrl: true,
            college: true,
          },
        },
      },
    });

    // To calculate actual rank, we need to know how many CAs have MORE referrals
    // For each CA in the result, calculate their rank based on referral count
    const rankedLeaderboard = await Promise.all(
      leaderboard.map(async (ca) => {
        // Count how many CAs have more referrals than this one
        const higherRankedCount = await prisma.caProfile.count({
          where: {
            numberOfReferrals: { gt: ca.numberOfReferrals },
          },
        });
        // Rank is higherRankedCount + 1 (1-indexed)
        const rank = higherRankedCount + 1;

        return {
          rank,
          id: ca.id,
          referralId: ca.referralId,
          referralCount: ca.numberOfReferrals,
          name: ca.user.firstName
            ? `${ca.user.firstName} ${ca.user.lastName ?? ""}`.trim()
            : ca.user.slugName || "Anonymous",
          avatarUrl: ca.user.candidatePhotoUrl ?? ca.user.googleAvatarUrl,
          college: ca.user.college,
        };
      }),
    );

    const totalPages = Math.ceil(totalCount / limit);

    new OkResponseStrategy().handleResponse(res, {
      info: "Leaderboard fetched successfully",
      leaderboard: rankedLeaderboard,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  },
);
