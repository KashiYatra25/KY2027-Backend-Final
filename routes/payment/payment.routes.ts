import { Router, type Router as ExpressRouter } from "express";
import { RequestGuardMiddleware } from "zodex-axon/core";
import { handlePaymentWebhook } from "@controller/payment/index.js";
import { paymentWebhookRequestSchema } from "@schemas/payment/index.js";

export const paymentRouter: ExpressRouter = Router();

// ═══════════════════════════════════════════════════════════════════
// WEBHOOK ROUTES
// Called by Go payment service - no user auth required
// Uses shared secret for verification (checked in controller)
// ═══════════════════════════════════════════════════════════════════

paymentRouter.post(
  "/webhook",
  RequestGuardMiddleware({ body: paymentWebhookRequestSchema }),
  handlePaymentWebhook,
);
