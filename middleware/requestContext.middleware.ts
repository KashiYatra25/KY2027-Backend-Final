/**
 * Request Context Middleware
 * ═══════════════════════════════════════════════════════════════════
 *
 * Generates a unique requestId for every incoming request and attaches
 * it to req for use in all subsequent logs.
 *
 * Usage:
 *   app.use(requestContextMiddleware);
 *   // Then in any handler:
 *   logger.info("Something happened", { requestId: req.requestId });
 */

import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      requestId: string;
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

export function requestContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // Use existing X-Request-ID header if provided (e.g., from load balancer)
  // Otherwise generate a new one
  req.requestId = (req.headers["x-request-id"] as string) || generateRequestId();
  req.startTime = Date.now();
  
  next();
}
