import { createCoupon } from "@root/controller/user/admin/coupon/index.js";
import {
  restProtectMiddleware,
  roleChecker,
} from "@middleware/protect/protect.route.factory.middleware.js";
import { checkUserAccountStatus } from "@middleware/protect/check.user.status.middleware.js";
import { createCouponSchema } from "@schemas/admin/coupon.schema.js";
import { Router, type Router as ExpressRouter } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";

export const couponRouter: ExpressRouter = Router();

// All coupon admin routes require authentication and account status check
couponRouter.use(restProtectMiddleware, checkUserAccountStatus);

// Create coupon - MASTER_ADMIN only
couponRouter.post(
  "/",
  roleChecker("REST", "MASTER_ADMIN"),
  RequestGuardMiddleware({ body: createCouponSchema }),
  createCoupon,
);
