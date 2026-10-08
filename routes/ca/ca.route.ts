import {
  createCaApplication,
  getCaApplicationStatus,
} from "@controller/user/ca/index.js";
import { getCaLeaderboard } from "@controller/user/ca/getCaLeaderboard.controller.js";
import { getCaRank } from "@controller/user/ca/getCaRank.controller.js";
import { validateReferralId } from "@controller/user/ca/validateReferralId.controller.js";
import { restProtectMiddleware, roleChecker } from "@middleware/protect/protect.route.factory.middleware.js";
import { checkWhetherProfileIsCompleteMiddleware } from "@middleware/user/profile/checkWhetherProfileIsComplete.middleware.js";
import { checkUserIsCa } from "@middleware/user/ca/checkUserIsCa.middleware.js";
import {
  caPublicRateLimiter,
  caApplicationRateLimiter,
} from "@middleware/limiters/index.js";
import { caApplicationSchema } from "@schemas/user/caApplication.schema.js";
import { validateReferralParamsSchema } from "@schemas/user/referral.schema.js";
import { Router, type Router as ExpressRouter } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";

export const caRouter: ExpressRouter = Router();

// ═══════════════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS (no auth required)
// ═══════════════════════════════════════════════════════════════════

// Get top 10 CAs by referral count
caRouter.get("/leaderboard", caPublicRateLimiter, getCaLeaderboard);

// Validate a referral ID (for frontend validation)
caRouter.get(
  "/validate/:referralId",
  caPublicRateLimiter,
  RequestGuardMiddleware({ params: validateReferralParamsSchema }),
  validateReferralId,
);

// ═══════════════════════════════════════════════════════════════════
// AUTHENTICATED ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

caRouter.use(restProtectMiddleware);

// Apply for CA - requires USER role and completed profile
caRouter.post(
  "/apply",
  caApplicationRateLimiter,
  roleChecker("REST", "USER"),
  checkWhetherProfileIsCompleteMiddleware,
  RequestGuardMiddleware({ body: caApplicationSchema }),
  createCaApplication,
);

// Get CA application status - just needs to be authenticated
caRouter.get("/status", getCaApplicationStatus);

// ═══════════════════════════════════════════════════════════════════
// CA-ONLY ENDPOINTS (requires user to be an approved CA)
// ═══════════════════════════════════════════════════════════════════

// Get CA's rank in the leaderboard
caRouter.get("/my-rank", checkUserIsCa, getCaRank);
