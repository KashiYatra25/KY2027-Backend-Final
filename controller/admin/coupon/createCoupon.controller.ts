import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";
import type { CreateCouponRequestSchemaType } from "@schemas/admin/coupon.schema.js";
import { generateUniqueCouponCode } from "@root/services/coupon/index.js";

/**
 * POST /admin/coupons
 * Create a new coupon with auto-generated code
 * Requirements:
 * - User must be authenticated
 * - User must have MASTER_ADMIN role
 */
const createCoupon = catchAsync(
  async (
    req: VerifiedRequest<
      { body: CreateCouponRequestSchemaType },
      AdminRequestWithVerifiedCreds
    >,
    res: Response,
    _next: NextFunction,
  ) => {
    const { adminId } = req.admin;
    const {
      description,
      type,
      value,
      maxUsageCount,
      maxUsagePerUser,
      validFrom,
      validUntil,
    } = req.validatedData;

    // Auto-generate unique coupon code
    const code = await generateUniqueCouponCode();

    // Create the coupon
    const coupon = await prisma.coupon.create({
      data: {
        code,
        description,
        type,
        value,
        maxUsageCount,
        maxUsagePerUser,
        validFrom: validFrom ? new Date(validFrom) : undefined,
        validUntil: validUntil ? new Date(validUntil) : undefined,
        createdBy: adminId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        code: true,
        description: true,
        type: true,
        value: true,
        maxUsageCount: true,
        maxUsagePerUser: true,
        validFrom: true,
        validUntil: true,
        status: true,
        createdAt: true,
      },
    });

    logger.info("Coupon created", {
      couponId: coupon.id,
      code: coupon.code,
      createdBy: adminId,
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Coupon created successfully",
      ...coupon,
    });
  },
);

export { createCoupon };
