import { getAllPasses } from "@controller/pass/index.js";
import { publicReadRateLimiterMiddleware } from "@root/middleware/limiters/index.js";
import { Router, type Router as ExpressRouter } from "express";

export const passRouter: ExpressRouter = Router();

// Public endpoints - no auth required
passRouter.get("/", publicReadRateLimiterMiddleware, getAllPasses);
