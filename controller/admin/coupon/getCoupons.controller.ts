import type { Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";
import type { CouponStatus } from "@lib/prisma/index.js";

/**
 * GET /admin/coupons
 * Fetch all coupons (with optional status filter)
 * Requirements:
 * - User must be authenticated as admin
 * - User must have MASTER_ADMIN role
 *
 * Query params:
 * - status: ACTIVE | EXPIRED | DISABLED (optional)
 */
const getCoupons = catchAsync(
  async (
    req: AdminRequestWithVerifiedCreds,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const status = req.query.status as CouponStatus | undefined;

    const whereClause = status ? { status } : {};

    const coupons = await prisma.coupon.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        code: true,
        description: true,
        type: true,
        value: true,
        maxUsageCount: true,
        maxUsagePerUser: true,
        currentUsageCount: true,
        validFrom: true,
        validUntil: true,
        status: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Coupons fetched successfully",
      coupons,
      count: coupons.length,
    });
  },
);

export { getCoupons };
