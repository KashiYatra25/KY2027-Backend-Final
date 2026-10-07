import type { Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/auth.types.helper.js";

/**
 * GET /admin/users
 * Fetch all users with admin roles (MASTER_ADMIN, MANAGER, OPERATOR)
 */
export const getAdminUsers = catchAsync(
  async (req: AuthenticatedUserRequestWithVerifiedEmail, res: Response) => {
    const adminUsers = await prisma.user.findMany({
      where: {
        role: {
          level: {
            in: ["MASTER_ADMIN", "MANAGER", "OPERATOR"],
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
            level: "asc", // MASTER_ADMIN first, then MANAGER, then OPERATOR
          },
        },
        {
          createdAt: "asc",
        },
      ],
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Admin users fetched successfully",
      data: adminUsers,
      count: adminUsers.length,
    });
  },
);
