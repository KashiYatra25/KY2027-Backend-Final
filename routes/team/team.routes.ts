import { Router, type Router as ExpressRouter } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";
import { userRoutesRESTProtectMiddleware } from "@root/middleware/user/protect/index.js";
import { checkWhetherProfileIsCompleteMiddleware } from "@root/middleware/user/profile/checkWhetherProfileIsComplete.middleware.js";
import { checkUserHasPaidMiddleware } from "@middleware/user/payment/index.js";
import { teamRateLimiter } from "@root/middleware/limiters/index.js";
import { createTeam } from "@controller/user/team/createTeam.controller.js";
import { getMyTeams } from "@controller/user/team/getMyTeams.controller.js";
import { createTeamRequestSchema } from "@schemas/team/team.schema.js";

export const teamRouter: ExpressRouter = Router();

// All team routes require auth
teamRouter.use(userRoutesRESTProtectMiddleware);

// Create a new team
// Middleware checks: auth -> profile complete -> user paid -> validate body -> controller
// Note: Controller also validates all MEMBERS have profile + paid
teamRouter.post(
  "/",
  teamRateLimiter,
  checkWhetherProfileIsCompleteMiddleware,
  checkUserHasPaidMiddleware,
  RequestGuardMiddleware({ body: createTeamRequestSchema }),
  createTeam,
);

// Get my teams
teamRouter.get("/my", getMyTeams);
