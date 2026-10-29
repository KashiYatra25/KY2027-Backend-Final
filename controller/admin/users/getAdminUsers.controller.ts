import type { Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";
import type { RoleLevel } from "@lib/prisma/index.js";

/**
 * GET /admin/get-admin-users
 * Fetch admin users from the Admin table (source of truth) based on requester's role:
 * - MASTER_ADMIN: Can see all admins (MASTER_ADMIN, MANAGER, OPERATOR)
 * - MANAGER: Can see only OPERATOR
 * - OPERATOR: Cannot see any admins (empty list)
 *
 * NOTE: We query from prisma.admin (not prisma.user) because:
 * - The Admin table is the source of truth for who has admin access
 * - A User can have an admin Role without having an Admin record (stale data)
 * - Only users with an Admin record can actually log into the admin panel
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
      // MASTER_ADMIN can see all admin roles
      visibleRoles = ["MASTER_ADMIN", "MANAGER", "OPERATOR"];
    } else if (requesterRole === "MANAGER") {
      // MANAGER can only see OPERATORs
      visibleRoles = ["OPERATOR"];
    } else {
      // OPERATOR cannot see any admins
      visibleRoles = [];
    }

    // If no visible roles, return empty list immediately
    if (visibleRoles.length === 0) {
      new OkResponseStrategy().handleResponse(res, {
        info: "Admin users fetched successfully",
        adminUsers: [],
        count: 0,
      });
      return;
    }

    // Query from Admin table (source of truth) and join with User/Role
    const admins = await prisma.admin.findMany({
      where: {
        user: {
          role: {
            level: {
              in: visibleRoles,
            },
          },
        },
      },
      select: {
        id: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            slugName: true,
            googleAvatarUrl: true,
            isSuspended: true,
            role: {
              select: {
                id: true,
                level: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Transform to flatten the response structure for frontend compatibility
    const adminUsers = admins.map((admin) => ({
      id: admin.user.id,
      visibleAdminId: admin.id,
      email: admin.user.email,
      firstName: admin.user.firstName,
      lastName: admin.user.lastName,
      slugName: admin.user.slugName,
      googleAvatarUrl: admin.user.googleAvatarUrl,
      isSuspended: admin.user.isSuspended,
      createdAt: admin.createdAt, // Use admin record creation date
      role: admin.user.role,
    }));

    // Sort by role level (MASTER_ADMIN first, then MANAGER, then OPERATOR)
    const rolePriority: Record<string, number> = {
      MASTER_ADMIN: 1,
      MANAGER: 2,
      OPERATOR: 3,
    };

    adminUsers.sort((a, b) => {
      const aPriority = rolePriority[a.role?.level ?? ""] ?? 99;
      const bPriority = rolePriority[b.role?.level ?? ""] ?? 99;
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      // Secondary sort by createdAt
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Admin users fetched successfully",
      adminUsers,
      count: adminUsers.length,
    });
  },
);
