import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";
import type {
  UpdateCouponRequestSchemaType,
  CouponIdParamRequestSchemaType,
} from "@schemas/admin/coupon.schema.js";

/**
 * PATCH /admin/coupons/:couponId
 * Update an existing coupon's mutable fields.
 * Requirements:
 * - User must be authenticated as admin
 * - User must have MASTER_ADMIN role
 *
 * Immutable fields (NOT updatable): code, type, status.
 * Status changes go through PATCH /admin/coupons/:couponId/status.
 */
const updateCoupon = catchAsync(
  async (
    req: VerifiedRequest<
      {
        params: CouponIdParamRequestSchemaType;
        body: UpdateCouponRequestSchemaType;
      },
      AdminRequestWithVerifiedCreds
    >,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { adminId } = req.admin;
    const { couponId } = req.validatedParams;
    const {
      description,
      value,
      maxUsageCount,
      maxUsagePerUser,
      validFrom,
      validUntil,
    } = req.validatedData;

    // Ensure the coupon exists
    const existingCoupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      select: { id: true, type: true },
    });

    if (!existingCoupon) {
      return next(
        new NotFound().handleResponse(res, {
          info: "Coupon not found",
        }),
      );
    }

    // Guard: PERCENTAGE value cannot exceed 100 (type is immutable, so use stored type)
    if (
      value !== undefined &&
      existingCoupon.type === "PERCENTAGE" &&
      value > 100
    ) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Percentage discount cannot exceed 100%",
        }),
      );
    }

    const updatedCoupon = await prisma.coupon.update({
      where: { id: couponId },
      data: {
        ...(description !== undefined && { description }),
        ...(value !== undefined && { value }),
        ...(maxUsageCount !== undefined && { maxUsageCount }),
        ...(maxUsagePerUser !== undefined && { maxUsagePerUser }),
        ...(validFrom !== undefined && { validFrom: new Date(validFrom) }),
        ...(validUntil !== undefined && {
          validUntil: validUntil ? new Date(validUntil) : null,
        }),
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
        updatedAt: true,
      },
    });

    logger.info("Coupon updated", {
      couponId: updatedCoupon.id,
      code: updatedCoupon.code,
      updatedBy: adminId,
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Coupon updated successfully",
      ...updatedCoupon,
    });
  },
);

export { updateCoupon };
