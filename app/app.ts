import { aadhaarRouter } from "@api/aadhaar/aadhaar.route.js";
import { userRouter } from "@api/user/user.route.js";
import { corsOptions } from "@constants/cors.options.js";
import { env } from "@lib/env/environment.js";
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
app.use(`${env.BASE_API_ENDPOINT}/aadhaar`, aadhaarRouter);

app.use(globalErrorHandler);

export { app };
