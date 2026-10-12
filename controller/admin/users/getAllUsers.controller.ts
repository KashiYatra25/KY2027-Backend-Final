import type { Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// GET ALL USERS (PAGINATED)
//
// Returns users with role level "USER" only (not admins).
// Includes isFromIITBhu flag so frontend can show "Upgrade to Admin" button.
//
// Query params:
// - page: number (default 1)
// - limit: number (default 20, max 50)
// - search: string (optional, searches email/firstName/lastName)
// ═══════════════════════════════════════════════════════════════════

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

export const getAllUsers = catchAsync(
  async (
    req: AdminRequestWithVerifiedCreds,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    // Parse pagination params
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const requestedLimit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;
    const limit = Math.min(Math.max(1, requestedLimit), MAX_LIMIT);
    const skip = (page - 1) * limit;

    // Optional search
    const search = (req.query.search as string)?.trim();

    // Build where clause - only users with role level "USER" (not admins)
    const whereClause: any = {
      OR: [
        { role: null }, // Users without a role record
        { role: { level: "USER" } }, // Users with USER role
      ],
    };

    // Add search filter if provided
    if (search) {
      whereClause.AND = {
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { slugName: { contains: search, mode: "insensitive" } },
          { kyId: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    // Get total count and users in parallel
    const [totalCount, users] = await Promise.all([
      prisma.user.count({ where: whereClause }),
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          slugName: true,
          googleAvatarUrl: true,
          phone: true,
          college: true,
          kyId: true,
          isFromIITBhu: true,
          isPaidUser: true,
          isSuspended: true,
          createdAt: true,
          role: {
            select: {
              level: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    new OkResponseStrategy().handleResponse(res, {
      info: "Users fetched successfully",
      users,
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
