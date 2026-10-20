import { Router, type Router as ExpressRouter } from "express";
import { handleKonfhubWebhook } from "@controller/payment/handleKonfhubWebhook.controller.js";
import { handleZonalsKonfhubWebhook } from "@controller/payment/handleZonalsKonfhubWebhook.controller.js";
import { verifyKonfhubWebhookMiddleware } from "@middleware/payment/verifyKonfhubWebhook.middleware.js";

export const paymentRouter: ExpressRouter = Router();

// ═══════════════════════════════════════════════════════════════════
// KONFHUB WEBHOOKS
// Called by KonfHub when attendees register/cancel/check-in
// 
// Configure webhook URLs in KonfHub dashboard:
// Main Fest: https://your-domain.com/api/v1/payment/webhooks/konfhub
// Zonals:    https://your-domain.com/api/v1/payment/webhooks/zonals
//
// Set KONFHUB_WEBHOOK_SECRET in your environment to enable verification.
// If not set, webhook verification is skipped (for development).
// ═══════════════════════════════════════════════════════════════════

// Main fest passes webhook
paymentRouter.post(
  "/webhooks/konfhub",
  verifyKonfhubWebhookMiddleware,
  handleKonfhubWebhook,
);

// Zonals passes webhook (separate KonfHub event)
paymentRouter.post(
  "/webhooks/zonals",
  verifyKonfhubWebhookMiddleware,
  handleZonalsKonfhubWebhook,
);
