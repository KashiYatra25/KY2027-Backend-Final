import type { Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma, Prisma } from "@root/prisma.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// GET ALL USERS (PAGINATED)
//
// Returns users with role level "USER" only (not admins).
// Includes isFromIITBhu flag so frontend can show "Upgrade to Admin" button.
// Also returns aggregate stats for all users (independent of pagination).
//
// Query params:
// - page: number (default 1)
// - limit: number (default 20, max 50)
// - search: string (optional, searches email/firstName/lastName/slugName/kyId)
// - isFromIITBhu: "true" | "false" (optional filter)
// - isPaidUser: "true" | "false" (optional filter)
// - isSuspended: "true" | "false" (optional filter)
// - hasPhone: "true" | "false" (optional filter for phone verification)
// - sortBy: "createdAt" | "firstName" | "email" | "college" (default: createdAt)
// - sortDir: "asc" | "desc" (default: desc)
// ═══════════════════════════════════════════════════════════════════

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

// Allowed sort fields (whitelist to prevent injection)
const ALLOWED_SORT_FIELDS = ["createdAt", "firstName", "email", "college", "kyId"] as const;
type SortField = (typeof ALLOWED_SORT_FIELDS)[number];

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

    // Optional filters
    const isFromIITBhuParam = req.query.isFromIITBhu as string | undefined;
    const isPaidUserParam = req.query.isPaidUser as string | undefined;
    const isSuspendedParam = req.query.isSuspended as string | undefined;
    const hasPhoneParam = req.query.hasPhone as string | undefined;

    // Sorting
    const sortByParam = req.query.sortBy as string | undefined;
    const sortDirParam = req.query.sortDir as string | undefined;
    
    const sortBy: SortField = ALLOWED_SORT_FIELDS.includes(sortByParam as SortField)
      ? (sortByParam as SortField)
      : "createdAt";
    const sortDir: "asc" | "desc" = sortDirParam === "asc" ? "asc" : "desc";

    // Build where clause - only users with role level "USER" (not admins)
    const baseWhereClause: Prisma.UserWhereInput = {
      OR: [
        { role: null }, // Users without a role record
        { role: { level: "USER" } }, // Users with USER role
      ],
    };

    // Build dynamic filter conditions
    const filterConditions: Prisma.UserWhereInput[] = [];

    // Filter: isFromIITBhu
    if (isFromIITBhuParam === "true") {
      filterConditions.push({ isFromIITBhu: true });
    } else if (isFromIITBhuParam === "false") {
      filterConditions.push({ isFromIITBhu: false });
    }

    // Filter: isPaidUser
    if (isPaidUserParam === "true") {
      filterConditions.push({ isPaidUser: true });
    } else if (isPaidUserParam === "false") {
      filterConditions.push({ isPaidUser: false });
    }

    // Filter: isSuspended
    if (isSuspendedParam === "true") {
      filterConditions.push({ isSuspended: true });
    } else if (isSuspendedParam === "false") {
      filterConditions.push({ isSuspended: false });
    }

    // Filter: hasPhone (phone verification)
    if (hasPhoneParam === "true") {
      filterConditions.push({ phone: { not: null } });
    } else if (hasPhoneParam === "false") {
      filterConditions.push({ phone: null });
    }

    // Search filter
    if (search) {
      filterConditions.push({
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { slugName: { contains: search, mode: "insensitive" } },
          { kyId: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    // Combine base clause with filters
    const whereClause: Prisma.UserWhereInput =
      filterConditions.length > 0
        ? { AND: [baseWhereClause, ...filterConditions] }
        : baseWhereClause;

    // Build orderBy clause
    const orderBy: Prisma.UserOrderByWithRelationInput = { [sortBy]: sortDir };

    // Get total count, users, and stats in parallel
    // Stats are computed from ALL users (no filters) to show global totals
    const [totalCount, users, iitbhuCount, paidCount, suspendedCount, verifiedProfileCount, phoneVerifiedCount] = await Promise.all([
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
        orderBy,
        skip,
        take: limit,
      }),
      // Stats: IIT BHU users (global, no filters)
      prisma.user.count({
        where: {
          ...baseWhereClause,
          isFromIITBhu: true,
        },
      }),
      // Stats: Paid users (global, no filters)
      prisma.user.count({
        where: {
          ...baseWhereClause,
          isPaidUser: true,
        },
      }),
      // Stats: Suspended users (global, no filters)
      prisma.user.count({
        where: {
          ...baseWhereClause,
          isSuspended: true,
        },
      }),
      // Stats: Verified profiles (users with kyId) (global, no filters)
      prisma.user.count({
        where: {
          ...baseWhereClause,
          kyId: { not: null },
        },
      }),
      // Stats: Phone verified users (global, no filters)
      prisma.user.count({
        where: {
          ...baseWhereClause,
          phone: { not: null },
        },
      }),
    ]);

    // Get total user count (without any filters) for stats
    const totalUsersCount = await prisma.user.count({ where: baseWhereClause });

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
      // Stats are global (independent of pagination/filters)
      stats: {
        totalUsers: totalUsersCount,
        iitbhuUsers: iitbhuCount,
        externalUsers: totalUsersCount - iitbhuCount,
        paidUsers: paidCount,
        freeUsers: totalUsersCount - paidCount,
        suspendedUsers: suspendedCount,
        verifiedProfiles: verifiedProfileCount,
        phoneVerified: phoneVerifiedCount,
        phoneUnverified: totalUsersCount - phoneVerifiedCount,
      },
    });
  },
);
