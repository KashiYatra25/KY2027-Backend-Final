import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/auth.types.helper.js";
import { prisma } from "@root/prisma.js";
import type { NextFunction, Response } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";

/**
 * GET /admin/ca/applications
 * Get all CA applications (with optional status filter)
 */
export const getCaApplications = catchAsync(
  async (
    req: VerifiedRequest<
      { query: { status: "PENDING" | "ACCEPTED" | "REJECTED" } },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const status = req.validatedQuery.status;

    const whereClause = status
      ? { status: status as "PENDING" | "ACCEPTED" | "REJECTED" }
      : {};

    const applications = await prisma.caApplication.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            slugName: true,
            college: true,
            phone: true,
            googleAvatarUrl: true,
          },
        },
        caProfile: {
          select: {
            referralId: true,
            numberOfReferrals: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "CA applications fetched successfully",
      data: applications,
      count: applications.length,
    });
  },
);
