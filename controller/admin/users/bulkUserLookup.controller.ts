import type { Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// BULK USER LOOKUP BY KY IDS
// 
// Look up multiple users by their KY IDs.
// Used for manual payment request creation.
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /admin/users/bulk-lookup
 * Look up multiple users by KY IDs
 * 
 * Query params:
 * - kyIds: comma-separated list of KY IDs (e.g., "KY-2027-ABC123,KY-2027-XYZ789")
 */
export const bulkUserLookup = catchAsync(
  async (
    req: AdminRequestWithVerifiedCreds,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const kyIdsParam = req.query.kyIds as string;

    if (!kyIdsParam || kyIdsParam.trim().length === 0) {
      new BadRequest().handleResponse(res, {
        info: "kyIds query parameter is required",
      });
      return;
    }

    // Parse and clean KY IDs
    const kyIds = kyIdsParam
      .split(",")
      .map((id) => id.trim().toUpperCase())
      .filter((id) => id.length > 0);

    if (kyIds.length === 0) {
      new BadRequest().handleResponse(res, {
        info: "At least one KY ID is required",
      });
      return;
    }

    if (kyIds.length > 100) {
      new BadRequest().handleResponse(res, {
        info: "Maximum 100 KY IDs per request",
      });
      return;
    }

    // Lookup users by KY IDs
    const users = await prisma.user.findMany({
      where: {
        kyId: { in: kyIds },
      },
      select: {
        id: true,
        kyId: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        college: true,
        isPaidUser: true,
        identityVerified: true,
      },
    });

    // Build results map
    const userMap = new Map(users.map((u) => [u.kyId?.toUpperCase(), u]));

    // Build response with found/not found status
    const results = kyIds.map((kyId) => {
      const user = userMap.get(kyId);
      if (user) {
        return {
          kyId,
          found: true,
          user: {
            id: user.id,
            kyId: user.kyId,
            email: user.email,
            name: user.firstName && user.lastName
              ? `${user.firstName} ${user.lastName}`.trim()
              : user.firstName || user.lastName || null,
            phone: user.phone,
            college: user.college,
            isPaidUser: user.isPaidUser,
            isIITBHU: user.college?.toLowerCase().includes("iit") &&
                      user.college?.toLowerCase().includes("bhu"),
          },
        };
      }
      return {
        kyId,
        found: false,
      };
    });

    const found = results.filter((r) => r.found);
    const notFound = results.filter((r) => !r.found);

    new OkResponseStrategy().handleResponse(res, {
      info: `Found ${found.length} of ${kyIds.length} users`,
      results,
      summary: {
        total: kyIds.length,
        found: found.length,
        notFound: notFound.length,
        notFoundKyIds: notFound.map((r) => r.kyId),
      },
    });
  },
);
