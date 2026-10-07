import {
  createCaApplication,
  getCaApplicationStatus,
} from "@controller/user/ca/index.js";
import { restProtectMiddleware, roleChecker } from "@middleware/protect/protect.route.factory.middleware.js";
import { checkWhetherProfileIsCompleteMiddleware } from "@middleware/user/profile/checkWhetherProfileIsComplete.middleware.js";
import { caApplicationSchema } from "@schemas/user/caApplication.schema.js";
import { Router, type Router as ExpressRouter } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";

export const caRouter: ExpressRouter = Router();

// All CA routes require authentication
caRouter.use(restProtectMiddleware);

// Apply for CA - requires USER role and completed profile
caRouter.post(
  "/apply",
  roleChecker("REST", "USER"),
  checkWhetherProfileIsCompleteMiddleware,
  RequestGuardMiddleware({ body: caApplicationSchema }),
  createCaApplication,
);

// Get CA application status - just needs to be authenticated
caRouter.get("/status", getCaApplicationStatus);
