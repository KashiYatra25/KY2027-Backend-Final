import {
  restProtectMiddleware,
  roleChecker,
} from "@middleware/protect/protect.route.factory.middleware.js";
import { verifyAdminCreds } from "@controller/user/admin/auth/verifyAdminCreds.controller.js";
import { makeUserAdmin } from "@controller/user/admin/invite/makeUserAdmin.controller.js";
import { getAdminUsers } from "@controller/user/admin/users/getAdminUsers.controller.js";
import {
  approveCaApplication,
  getCaApplications,
} from "@controller/user/admin/ca/index.js";
import {
  validateTargetUserForInvite,
  checkAdminDoesNotExist,
} from "@middleware/admin/invite/index.js";
import { validateUserIsAdmin } from "@middleware/admin/auth/auth.middleware.js";
import {
  adminCredVerificationSchema,
  adminInviteSchema,
} from "@schemas/admin/admin.schema.js";
import { caApprovalSchema } from "@schemas/admin/caApproval.schema.js";
import { Router, type Router as ExpressRouter } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";
import { checkUserAccountStatus } from "@middleware/protect/check.user.status.middleware.js";

// Payment verification pipeline --> Manually
// operator -> payment request generation --> every details msut be sent to  --> master admin --> if rejected then send a note . .... that person can only see his 
// Manager --> payment request generation --> 

export const adminRouter: ExpressRouter = Router();

adminRouter.use(restProtectMiddleware, checkUserAccountStatus);

// Fetch all admin users (MASTER_ADMIN, MANAGER, OPERATOR)
adminRouter.get(
  "/users",
  roleChecker("REST", "MASTER_ADMIN", "MANAGER"),
  getAdminUsers,
);

// CA Application management - MASTER_ADMIN only
adminRouter.get(
  "/campus-ambessador/get-applications",
  roleChecker("REST", "MASTER_ADMIN"),
  getCaApplications,
);

adminRouter.post(
  "/campus-ambessador/approve-request",
  roleChecker("REST", "MASTER_ADMIN"),
  RequestGuardMiddleware({ body: caApprovalSchema }),
  approveCaApplication,
);

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
