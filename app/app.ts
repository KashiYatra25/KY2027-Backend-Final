import { aadhaarRouter } from "@api/aadhaar/aadhaar.route.js";
import { adminRouter } from "@api/admin/admin.route.js";
import { caRouter } from "@api/ca/ca.route.js";
import { couponRouter } from "@api/coupon/coupon.route.js";
import { passRouter } from "@api/pass/pass.route.js";
import { userRouter } from "@api/user/user.route.js";
import { corsOptions } from "@constants/cors.options.js";
import { env } from "@lib/env/environment.js";
import { logger } from "@logger/index.js";
import cookieParser from "cookie-parser";
import cors from "cors";

import type { Application } from "express";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { globalErrorHandler } from "zodex-axon/errors";

const app: Application = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(morgan("dev"));
app.use(cookieParser());
app.use(helmet());
app.use(cors(corsOptions));



app.use(`${env.BASE_API_ENDPOINT}/user`, userRouter);
app.use(`${env.BASE_API_ENDPOINT}/admin`, adminRouter);
app.use(`${env.BASE_API_ENDPOINT}/aadhaar`, aadhaarRouter);
app.use(`${env.BASE_API_ENDPOINT}/pass`, passRouter);
app.use(`${env.BASE_API_ENDPOINT}/ca`, caRouter);
app.use(`${env.BASE_API_ENDPOINT}/coupon`, couponRouter);

app.use(globalErrorHandler);

logger.info("Express app initialised", {
  baseEndpoint: env.BASE_API_ENDPOINT,
  nodeEnv: process.env.NODE_ENV,
});

export { app };
