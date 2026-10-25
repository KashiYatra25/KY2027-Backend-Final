/**
 * Request Context Middleware
 * ═══════════════════════════════════════════════════════════════════
 *
 * Generates a unique requestId for every incoming request and attaches
 * it to req for use in all subsequent logs. Also extracts real client IP.
 *
 * Usage:
 *   app.use(requestContextMiddleware);
 *   // Then in any handler:
 *   logger.info("Something happened", { requestId: req.requestId, ip: req.clientIp });
 */

import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      clientIp: string;
      startTime: number;
    }
  }
}

/**
 * Generates short requestId (first 8 chars of UUID)
 * Full UUID is overkill for most use cases
 */
function generateRequestId(): string {
  return randomUUID().slice(0, 8);
}

/**
 * Extract real client IP from request
 * Priority: CF-Connecting-IP > X-Forwarded-For (first) > req.ip
 */
function extractClientIp(req: Request): string {
  // Cloudflare always sets this to the real client IP
  const cfIp = req.headers["cf-connecting-ip"];
  if (typeof cfIp === "string") return cfIp;

  // X-Forwarded-For can be comma-separated, first one is the client
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  return req.ip ?? "unknown";
}

export function requestContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // Use existing X-Request-ID header if provided (e.g., from load balancer)
  // Otherwise generate a new one
  req.requestId = (req.headers["x-request-id"] as string) || generateRequestId();
  req.clientIp = extractClientIp(req);
  req.startTime = Date.now();
  
  next();
}
