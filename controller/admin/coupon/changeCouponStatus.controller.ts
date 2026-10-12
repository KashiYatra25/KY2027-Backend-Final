import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";
import type {
  ChangeCouponStatusRequestSchemaType,
  CouponIdParamRequestSchemaType,
} from "@schemas/admin/coupon.schema.js";

// ═══════════════════════════════════════════════════════════════════
// CHANGE COUPON STATUS (Disable / Reactivate)
//
// PATCH /admin/coupons/:couponId/status
//
// Toggles a coupon between ACTIVE and DISABLED.
//   - DISABLED → turn an active coupon off (stops redemptions)
//   - ACTIVE   → reactivate a disabled coupon
//
// Note: EXPIRED is a system-derived state (driven by validUntil) and is
// NOT settable here. A coupon that is EXPIRED cannot be reactivated via
// this endpoint - update its validUntil first.
// ═══════════════════════════════════════════════════════════════════

const changeCouponStatus = catchAsync(
  async (
    req: VerifiedRequest<
      {
        params: CouponIdParamRequestSchemaType;
        body: ChangeCouponStatusRequestSchemaType;
      },
      AdminRequestWithVerifiedCreds
    >,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { adminId } = req.admin;
    const { couponId } = req.validatedParams;
    const { status: newStatus } = req.validatedData;

    // ─────────────────────────────────────────────────────────────────
    // 1. Find the coupon
    // ─────────────────────────────────────────────────────────────────
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      select: { id: true, code: true, status: true },
    });

    if (!coupon) {
      return next(
        new NotFound().handleResponse(res, {
          info: "Coupon not found",
        }),
      );
    }

    const currentStatus = coupon.status;

    // ─────────────────────────────────────────────────────────────────
    // 2. Validate: Cannot change an EXPIRED coupon via this endpoint
    // ─────────────────────────────────────────────────────────────────
    if (currentStatus === "EXPIRED") {
      return next(
        new BadRequest().handleResponse(res, {
          info: "This coupon has expired. Update its validity window instead of changing status.",
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // 3. Validate: Status must actually change (no-op not allowed)
    // ─────────────────────────────────────────────────────────────────
    if (currentStatus === newStatus) {
      return next(
        new BadRequest().handleResponse(res, {
          info: `Coupon is already ${currentStatus.toLowerCase()}. No change needed.`,
        }),
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // 4. Apply the status change
    // ─────────────────────────────────────────────────────────────────
    const updatedCoupon = await prisma.coupon.update({
      where: { id: couponId },
      data: { status: newStatus },
      select: {
        id: true,
        code: true,
        status: true,
        updatedAt: true,
      },
    });

    logger.info("Coupon status changed", {
      couponId: updatedCoupon.id,
      code: updatedCoupon.code,
      previousStatus: currentStatus,
      newStatus: updatedCoupon.status,
      changedBy: adminId,
    });

    new OkResponseStrategy().handleResponse(res, {
      info:
        newStatus === "DISABLED"
          ? "Coupon disabled successfully"
          : "Coupon reactivated successfully",
      couponId: updatedCoupon.id,
      code: updatedCoupon.code,
      previousStatus: currentStatus,
      newStatus: updatedCoupon.status,
    });
  },
);

export { changeCouponStatus };
