import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";
import type { CouponIdParamRequestSchemaType } from "@schemas/admin/coupon.schema.js";

/**
 * DELETE /admin/coupons/:couponId
 * Permanently delete a coupon.
 * Requirements:
 * - User must be authenticated as admin
 * - User must have MASTER_ADMIN role
 *
 * A coupon that already has usage records CANNOT be deleted (the
 * CouponUsage relation uses onDelete: Restrict to preserve the audit
 * trail). Disable it via PATCH /admin/coupons/:couponId/status instead.
 */
const deleteCoupon = catchAsync(
  async (
    req: VerifiedRequest<
      { params: CouponIdParamRequestSchemaType },
      AdminRequestWithVerifiedCreds
    >,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { adminId } = req.admin;
    const { couponId } = req.validatedParams;

    // Ensure the coupon exists and check whether it has been used
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      select: {
        id: true,
        code: true,
        _count: {
          select: { usages: true },
        },
      },
    });

    if (!coupon) {
      return next(
        new NotFound().handleResponse(res, {
          info: "Coupon not found",
        }),
      );
    }

    // Block deletion if the coupon has usage records (preserve audit trail)
    if (coupon._count.usages > 0) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Cannot delete a coupon that has already been used. Disable it instead.",
        }),
      );
    }

    await prisma.coupon.delete({
      where: { id: couponId },
    });

    logger.info("Coupon deleted", {
      couponId: coupon.id,
      code: coupon.code,
      deletedBy: adminId,
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Coupon deleted successfully",
      deletedCouponId: coupon.id,
    });
  },
);

export { deleteCoupon };
