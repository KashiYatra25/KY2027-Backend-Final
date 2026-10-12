import {
  createCoupon,
  getCoupons,
  updateCoupon,
  changeCouponStatus,
  deleteCoupon,
} from "@controller/admin/coupon/index.js";
import { adminRateLimiter } from "@middleware/limiters/index.js";
import { adminRoutesRESTProtectMiddleware } from "@middleware/admin/protect/adminRoutesRESTProtect.middleware.js";
import { checkAdminAccountStatusMiddleware } from "@middleware/admin/protect/checkAdminAccountStatus.middleware.js";
import { adminRoleCheckerMiddleware } from "@middleware/admin/protect/adminRoleChecker.middleware.js";
import {
  createCouponRequestSchema,
  updateCouponRequestSchema,
  changeCouponStatusRequestSchema,
  couponIdParamRequestSchema,
} from "@schemas/admin/coupon.schema.js";
import { Router, type Router as ExpressRouter } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";

export const couponRouter: ExpressRouter = Router();

// ═══════════════════════════════════════════════════════════════════
// All coupon routes require a valid admin JWT + active account.
// Coupon management is restricted to MASTER_ADMIN.
// ═══════════════════════════════════════════════════════════════════

couponRouter.use(
  adminRateLimiter,
  adminRoutesRESTProtectMiddleware,
  checkAdminAccountStatusMiddleware,
);

/**
 * GET /coupons
 * List all coupons (optional ?status=ACTIVE|EXPIRED|DISABLED filter)
 */
couponRouter.get(
  "/",
  adminRoleCheckerMiddleware("MASTER_ADMIN"),
  getCoupons,
);

/**
 * POST /coupons
 * Create a new coupon
 */
couponRouter.post(
  "/",
  adminRoleCheckerMiddleware("MASTER_ADMIN"),
  RequestGuardMiddleware({ body: createCouponRequestSchema }),
  createCoupon,
);

/**
 * PATCH /coupons/:couponId
 * Update a coupon's mutable fields
 */
couponRouter.patch(
  "/:couponId",
  adminRoleCheckerMiddleware("MASTER_ADMIN"),
  RequestGuardMiddleware({
    params: couponIdParamRequestSchema,
    body: updateCouponRequestSchema,
  }),
  updateCoupon,
);

/**
 * PATCH /coupons/:couponId/status
 * Disable or reactivate a coupon (ACTIVE ↔ DISABLED)
 */
couponRouter.patch(
  "/:couponId/status",
  adminRoleCheckerMiddleware("MASTER_ADMIN"),
  RequestGuardMiddleware({
    params: couponIdParamRequestSchema,
    body: changeCouponStatusRequestSchema,
  }),
  changeCouponStatus,
);

/**
 * DELETE /coupons/:couponId
 * Permanently delete a coupon (only if it has no usage records)
 */
couponRouter.delete(
  "/:couponId",
  adminRoleCheckerMiddleware("MASTER_ADMIN"),
  RequestGuardMiddleware({ params: couponIdParamRequestSchema }),
  deleteCoupon,
);
