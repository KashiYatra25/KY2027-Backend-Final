/**
 * HTTP Metrics Middleware
 * ═══════════════════════════════════════════════════════════════════
 *
 * Records request count and duration for all HTTP requests.
 * Detects GraphQL requests and extracts operation name when available.
 *
 * Usage: app.use(httpMetricsMiddleware);
 */

import type { Request, Response, NextFunction } from "express";
import { metrics } from "@services/metrics/index.js";

/**
 * Normalize path to avoid high-cardinality metrics
 * e.g., /api/v1/users/123 → /api/v1/users/:id
 */
function normalizePath(path: string): string {
  return path
    // Replace UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":uuid")
    // Replace numeric IDs
    .replace(/\/\d+/g, "/:id")
    // Replace Google-style user IDs (long numeric strings)
    .replace(/\/\d{10,}/g, "/:id");
}

/**
 * Extract GraphQL operation name from request body
 */
function extractGraphQLOperation(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const b = body as Record<string, unknown>;
  
  // Try operationName field first
  if (typeof b.operationName === "string" && b.operationName) {
    return b.operationName;
  }
  
  // Try to extract from query string (first word after query/mutation)
  if (typeof b.query === "string") {
    const match = b.query.match(/(?:query|mutation)\s+(\w+)/);
    if (match) return match[1];
  }
  
  return undefined;
}

export function httpMetricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const path = normalizePath(req.path);
  const isGraphQL = req.path.includes("/graphql");
  
  // Extract GraphQL operation name if applicable
  let graphqlOperation: string | undefined;
  if (isGraphQL && req.body) {
    graphqlOperation = extractGraphQLOperation(req.body);
  }

  // Hook into response finish
  res.on("finish", () => {
    const durationMs = Date.now() - startTime;
    
    metrics.recordHttpRequest({
      method: req.method,
      path,
      status: res.statusCode,
      durationMs,
      isGraphQL,
      graphqlOperation,
    });
  });

  next();
}
