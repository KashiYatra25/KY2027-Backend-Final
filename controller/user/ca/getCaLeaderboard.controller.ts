import type { Response, NextFunction, Request } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";

/**
 * GET /ca/leaderboard
 * Get top 10 CAs by referral count
 * Public endpoint - no auth required
 */
export const getCaLeaderboard = catchAsync(
  async (
    _req: Request,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const leaderboard = await prisma.caProfile.findMany({
      where: {
        numberOfReferrals: { gt: 0 }, // Only include CAs with at least 1 referral
      },
      orderBy: {
        numberOfReferrals: "desc",
      },
      take: 10,
      select: {
        referralId: true,
        numberOfReferrals: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            googleAvatarUrl: true,
            candidatePhotoUrl: true,
            college: true,
          },
        },
      },
    });

    const rankedLeaderboard = leaderboard.map((ca, index) => ({
      rank: index + 1,
      referralId: ca.referralId,
      referralCount: ca.numberOfReferrals,
      name: ca.user.firstName
        ? `${ca.user.firstName} ${ca.user.lastName ?? ""}`.trim()
        : "Anonymous",
      avatarUrl: ca.user.candidatePhotoUrl ?? ca.user.googleAvatarUrl,
      college: ca.user.college,
    }));

    new OkResponseStrategy().handleResponse(res, {
      info: "Leaderboard fetched successfully",
      leaderboard: rankedLeaderboard,
      count: rankedLeaderboard.length,
    });
  },
);
