import { Router, type Router as ExpressRouter } from "express";
import { handleKonfhubWebhook } from "@controller/payment/index.js";
import { verifyKonfhubWebhook } from "@middleware/payment/index.js";

export const paymentRouter: ExpressRouter = Router();

// ═══════════════════════════════════════════════════════════════════
// KONFHUB WEBHOOK
// Called by KonfHub when attendees register/cancel/check-in
// 
// Configure webhook URL in KonfHub dashboard:
// https://your-domain.com/api/v1/payment/webhooks/konfhub?secret=YOUR_SECRET
//
// Set KONFHUB_WEBHOOK_SECRET in your environment to enable verification.
// If not set, webhook verification is skipped (for development).
// ═══════════════════════════════════════════════════════════════════

paymentRouter.post(
  "/webhooks/konfhub",
  verifyKonfhubWebhook,
  handleKonfhubWebhook,
);
