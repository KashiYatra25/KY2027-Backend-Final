import { getAllPasses } from "@controller/pass/index.js";
import { Router, type Router as ExpressRouter } from "express";

export const passRouter: ExpressRouter = Router();

// Public endpoints - no auth required
passRouter.get("/", getAllPasses);
