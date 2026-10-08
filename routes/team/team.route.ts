import { Router, type Router as ExpressRouter } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";
import { restProtectMiddleware } from "@middleware/protect/protect.route.factory.middleware.js";
import { checkWhetherProfileIsCompleteMiddleware } from "@middleware/user/profile/checkWhetherProfileIsComplete.middleware.js";
import { checkUserHasPaidMiddleware } from "@middleware/user/payment/index.js";
import { teamRateLimiter } from "@middleware/limiters/index.js";
import { createTeam, getMyTeams } from "@controller/user/team/index.js";
import { createTeamSchema } from "@schemas/team/team.schema.js";

export const teamRouter: ExpressRouter = Router();

// All team routes require auth
teamRouter.use(restProtectMiddleware);

// Create a new team
// Middleware checks: auth -> profile complete -> user paid -> validate body -> controller
// Note: Controller also validates all MEMBERS have profile + paid
teamRouter.post(
  "/",
  teamRateLimiter,
  checkWhetherProfileIsCompleteMiddleware,
  checkUserHasPaidMiddleware,
  RequestGuardMiddleware({ body: createTeamSchema }),
  createTeam,
);

// Get my teams
teamRouter.get("/my", getMyTeams);
