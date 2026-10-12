import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";
import type { CreateCouponRequestSchemaType } from "@schemas/admin/coupon.schema.js";

/**
 * POST /admin/coupon
 * Create a new coupon
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
    next: NextFunction,
  ) => {
    const { adminId } = req.admin;
    const {
      code,
      description,
      type,
      value,
      maxUsageCount,
      maxUsagePerUser,
      validFrom,
      validUntil,
    } = req.validatedData;

    // Check if coupon code already exists
    const existingCoupon = await prisma.coupon.findUnique({
      where: { code },
    });

    if (existingCoupon) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Coupon code already exists",
        }),
      );
    }

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
