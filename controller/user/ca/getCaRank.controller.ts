import type { Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@utils/helper/auth.types.helper.js";

/**
 * GET /ca/rank
 * Get CA's own rank in the leaderboard
 * Requires: authenticated + is CA (middleware)
 */
export const getCaRank = catchAsync(
  async (
    req: AuthenticatedUserRequestWithVerifiedEmail,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { id: userId } = req.user;

    // Get the CA's profile
    const caProfile = await prisma.caProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        numberOfReferrals: true,
      },
    });

    // Count how many CAs have more referrals than this CA
    const higherRankedCount = await prisma.caProfile.count({
      where: {
        numberOfReferrals: { gt: caProfile!.numberOfReferrals },
      },
    });

    // Rank is position (1-indexed)
    const rank = higherRankedCount + 1;

    // Get total CA count for context
    const totalCas = await prisma.caProfile.count();

    new OkResponseStrategy().handleResponse(res, {
      info: "Rank fetched successfully",
      rank,
      totalCas,
      referralCount: caProfile!.numberOfReferrals,
      percentile: totalCas > 1 
        ? Math.round(((totalCas - rank) / (totalCas - 1)) * 100) 
        : 100,
    });
  },
);
