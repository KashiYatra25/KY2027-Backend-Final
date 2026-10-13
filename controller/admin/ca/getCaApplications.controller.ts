import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";
import { prisma } from "@root/prisma.js";
import type { NextFunction, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest } from "zodex-axon/errors";

const VALID_CA_STATUSES = ["PENDING", "ACCEPTED", "REJECTED"] as const;
type CaStatus = (typeof VALID_CA_STATUSES)[number];

/**
 * GET /admin/ca/applications
 * Get all CA applications (with optional status filter)
 */
export const getCaApplications = catchAsync(
  async (
    req: AdminRequestWithVerifiedCreds,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const rawStatus = req.query.status as string | undefined;

    // Validate optional status filter against the enum (avoid Prisma 500 on bad input)
    if (rawStatus !== undefined && !VALID_CA_STATUSES.includes(rawStatus as CaStatus)) {
      return next(
        new BadRequest().handleResponse(res, {
          info: `Invalid status filter. Must be one of: ${VALID_CA_STATUSES.join(", ")}`,
        }),
      );
    }

    const status = rawStatus as CaStatus | undefined;
    const whereClause = status ? { status } : {};

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
      applications,
      count: applications.length,
    });
  },
);
