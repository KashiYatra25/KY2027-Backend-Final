import { aadhaarRouter } from "@api/aadhaar/aadhaar.routes.js";
import { adminRouter } from "@api/admin/admin.routes.js";
import { caRouter } from "@api/ca/ca.routes.js";
import { passRouter } from "@api/pass/pass.routes.js";
import { userRouter } from "@api/user/user.routes.js";
import { eventRouter } from "@api/event/event.routes.js";
import { teamRouter } from "@api/team/team.routes.js";
import { scheduleRouter } from "@api/schedule/schedule.routes.js";
import { paymentRouter } from "@api/payment/payment.routes.js";
import { default as zonalsRouter } from "@api/zonals/zonals.routes.js";
import { corsOptions } from "@constants/cors.options.js";
import { env } from "@lib/env/environment.js";
import { logger } from "@logger/logger.js";
import { globalRateLimiterMiddleware } from "@root/middleware/limiters/index.js";
import cookieParser from "cookie-parser";
import cors from "cors";

import type { Application } from "express";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { globalErrorHandler } from "@root/middleware/errorHandler.middleware.js";

const app: Application = express();

// Trust proxy configuration for NLB → Nginx → Express setup
// With NLB preserving source IP and Nginx setting X-Forwarded-For: $remote_addr,
// we only need to trust the loopback connection from Nginx.
// This ensures req.ip returns the real client IP from X-Forwarded-For header.
app.set("trust proxy", "loopback");

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(morgan("dev"));
app.use(cookieParser());
app.use(helmet());
app.use(cors(corsOptions));

// Global rate limiter - 100 requests/minute per IP across all endpoints
app.use(globalRateLimiterMiddleware);

app.use(`${env.BASE_API_ENDPOINT}/user`, userRouter);
app.use(`${env.BASE_API_ENDPOINT}/admin`, adminRouter);
app.use(`${env.BASE_API_ENDPOINT}/aadhaar`, aadhaarRouter);
app.use(`${env.BASE_API_ENDPOINT}/events`, eventRouter);
app.use(`${env.BASE_API_ENDPOINT}/teams`, teamRouter);
app.use(`${env.BASE_API_ENDPOINT}/campus-ambassador`, caRouter);
app.use(`${env.BASE_API_ENDPOINT}/pass`, passRouter);
app.use(`${env.BASE_API_ENDPOINT}/schedule`, scheduleRouter);
app.use(`${env.BASE_API_ENDPOINT}/payment`, paymentRouter);
app.use(`${env.BASE_API_ENDPOINT}/zonals`, zonalsRouter);

app.use(globalErrorHandler);

logger.info("Express app initialised", {
  baseEndpoint: env.BASE_API_ENDPOINT,
  nodeEnv: process.env.NODE_ENV,
});

export { app };
