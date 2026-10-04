import {
  restProtectMiddleware,
  roleChecker,
} from "@middleware/protect/protect.route.factory.middleware.js";
import { verifyAdminCreds } from "@controller/user/admin/auth/index.js";
import { makeUserAdmin } from "@controller/user/admin/invite/index.js";
import {
  validateTargetUserForInvite,
  checkAdminDoesNotExist,
} from "@middleware/admin/invite/index.js";
import { validateUserIsAdmin } from "@middleware/admin/auth/index.js";
import {
  adminCredVerificationSchema,
  adminInviteSchema,
} from "@schemas/admin/admin.schema.js";
import { Router, type Router as ExpressRouter } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";
import { checkUserAccountStatus } from "@middleware/protect/check.user.status.middleware.js";

export const adminRouter: ExpressRouter = Router();

adminRouter.use(restProtectMiddleware, checkUserAccountStatus);

adminRouter.post(
  "/convert-to-admin",
  roleChecker("REST", "MASTER_ADMIN"),
  RequestGuardMiddleware({ body: adminInviteSchema }),
  validateTargetUserForInvite,
  checkAdminDoesNotExist,
  makeUserAdmin,
);

adminRouter.post(
  "/verify-admin-creds",
  roleChecker("REST", "MANAGER", "MASTER_ADMIN", "OPERATOR"),
  RequestGuardMiddleware({ body: adminCredVerificationSchema }),
  validateUserIsAdmin,
  verifyAdminCreds,
);
