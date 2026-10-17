import type { Request, Response, NextFunction } from "express";
import { env } from "@lib/env/environment.js";
import { logger } from "@logger/logger.js";

// ═══════════════════════════════════════════════════════════════════
// KONFHUB WEBHOOK SECURITY MIDDLEWARE
// 
// Defense in depth approach since KonfHub doesn't provide HMAC signatures:
// 
// 1. Shared secret in query param (weak but adds a layer)
// 2. Rate limiting on the endpoint (prevents brute force)
// 3. Payload validation via Zod schema (rejects malformed requests)
// 4. User must exist in DB to be marked as paid
// 5. Idempotency via unique attendee_id (can't double-process)
// 6. Logging of all attempts for audit trail
//
// For production, also consider:
// - Monitoring for unusual patterns (many failed attempts)
// - Manual review of unmatched purchases
// - Periodic reconciliation with KonfHub dashboard
// ═══════════════════════════════════════════════════════════════════

export const verifyKonfhubWebhook = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const configuredSecret = env.KONFHUB_WEBHOOK_SECRET;
  
  // If no secret configured, skip verification (development mode)
  if (!configuredSecret || configuredSecret.length === 0) {
    logger.warn({
      msg: "KonfHub webhook secret not configured - skipping verification",
      ip: req.ip,
    });
    return next();
  }

  // Get secret from query parameter
  const providedSecret = req.query.secret as string | undefined;

  if (!providedSecret) {
    logger.warn({
      msg: "KonfHub webhook rejected - no secret provided",
      ip: req.ip,
      headers: {
        "user-agent": req.headers["user-agent"],
        "x-forwarded-for": req.headers["x-forwarded-for"],
      },
    });
    return res.status(401).json({
      statusCode: 401,
      message: "Unauthorized - missing webhook secret",
    });
  }

  // Constant-time comparison to prevent timing attacks
  if (providedSecret.length !== configuredSecret.length) {
    logger.warn({
      msg: "KonfHub webhook rejected - invalid secret",
      ip: req.ip,
    });
    return res.status(401).json({
      statusCode: 401,
      message: "Unauthorized - invalid webhook secret",
    });
  }

  let mismatch = 0;
  for (let i = 0; i < providedSecret.length; i++) {
    mismatch |= providedSecret.charCodeAt(i) ^ configuredSecret.charCodeAt(i);
  }

  if (mismatch !== 0) {
    logger.warn({
      msg: "KonfHub webhook rejected - invalid secret",
      ip: req.ip,
    });
    return res.status(401).json({
      statusCode: 401,
      message: "Unauthorized - invalid webhook secret",
    });
  }

  // Secret matches - proceed
  logger.debug({
    msg: "KonfHub webhook secret verified",
    ip: req.ip,
  });
  
  next();
};
