import { Router, type Router as ExpressRouter } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";
import { restProtectMiddleware } from "@middleware/protect/protect.route.factory.middleware.js";
import { checkWhetherProfileIsCompleteMiddleware } from "@middleware/user/profile/checkWhetherProfileIsComplete.middleware.js";
import { createTeam, getMyTeams } from "@controller/user/team/index.js";
import { createTeamSchema } from "@schemas/team/team.schema.js";

export const teamRouter: ExpressRouter = Router();

// All team routes require auth
teamRouter.use(restProtectMiddleware);

// Create a new team - requires completed profile
teamRouter.post(
  "/",
  checkWhetherProfileIsCompleteMiddleware,
  RequestGuardMiddleware({ body: createTeamSchema }),
  createTeam,
);

// Get my teams - no profile check (just viewing)
teamRouter.get("/my", getMyTeams);
