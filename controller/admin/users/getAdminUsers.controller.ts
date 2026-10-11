import type { Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";
import type { RoleLevel } from "@lib/prisma/index.js";

/**
 * GET /admin/users
 * Fetch admin users based on requester's role:
 * - MASTER_ADMIN: Can see MANAGER and OPERATOR
 * - MANAGER: Can see only OPERATOR
 */
export const getAdminUsers = catchAsync(
  async (
    req: AdminRequestWithVerifiedCreds,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const requesterRole = req.admin.role;

    // Determine which roles the requester can see
    let visibleRoles: RoleLevel[];

    if (requesterRole === "MASTER_ADMIN") {
      visibleRoles = ["MANAGER", "OPERATOR"];
    } else if (requesterRole === "MANAGER") {
      visibleRoles = ["OPERATOR"];
    } else {
      // Should not reach here due to roleChecker middleware, but safety fallback
      visibleRoles = [];
    }

    const adminUsers = await prisma.user.findMany({
      where: {
        role: {
          level: {
            in: visibleRoles,
          },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        slugName: true,
        googleAvatarUrl: true,
        createdAt: true,
        role: {
          select: {
            id: true,
            level: true,
            createdAt: true,
          },
        },
      },
      orderBy: [
        {
          role: {
            level: "asc", // MANAGER first, then OPERATOR
          },
        },
        {
          createdAt: "asc",
        },
      ],
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Admin users fetched successfully",
      adminUsers,
      count: adminUsers.length,
    });
  },
);
