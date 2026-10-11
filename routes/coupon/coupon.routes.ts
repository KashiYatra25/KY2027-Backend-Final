import { createCoupon } from "@root/controller/admin/coupon/createCoupon.controller.js";
import {
  userRoutesRESTProtectMiddleware,
  roleCheckerMiddleware,
} from "@root/middleware/user/protect/index.js";
import { checkUserAccountStatusMiddleware } from "@root/middleware/user/protect/check.user.status.middleware.js";
import { createCouponRequestSchema } from "@schemas/admin/coupon.schema.js";
import { Router, type Router as ExpressRouter } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";

export const couponRouter: ExpressRouter = Router();

// All coupon admin routes require authentication and account status check
couponRouter.use(userRoutesRESTProtectMiddleware, checkUserAccountStatusMiddleware);

// Create coupon - MASTER_ADMIN only
couponRouter.post(
  "/",
  roleCheckerMiddleware("REST", "MASTER_ADMIN"),
  RequestGuardMiddleware({ body: createCouponRequestSchema }),
  createCoupon,
);
