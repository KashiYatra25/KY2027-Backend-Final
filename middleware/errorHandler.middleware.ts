import { logger } from "@logger/logger.js";
import type { ErrorRequestHandler } from "express";
import { globalErrorHandler as zodexErrorHandler } from "zodex-axon/errors";

/**
 * Custom error handler that logs errors before delegating to zodex-axon.
 * zodex-axon's handler does NOT log - this ensures errors reach Loki.
 */
export const globalErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const isServerError = statusCode >= 500;

  // Build detailed context for tracing
  const logContext: Record<string, unknown> = {
    statusCode,
    method: req.method,
    path: req.path,
    url: req.originalUrl,
    requestId: req.headers["x-request-id"] || "none",
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    origin: req.headers["origin"],
    referer: req.headers["referer"],
  };

  // Add error details
  if (err.message) logContext.message = err.message;
  if (err.name) logContext.errorName = err.name;
  if (err.code) logContext.errorCode = err.code;
  if (err.data) logContext.errorData = err.data;

  // For 5xx - full stack trace and extra details
  if (isServerError) {
    if (err.stack) logContext.stack = err.stack;
    if (err.cause) logContext.cause = String(err.cause);
    
    // Log query params and body for debugging (exclude sensitive fields)
    if (Object.keys(req.query).length > 0) {
      logContext.query = req.query;
    }
    if (req.body && typeof req.body === "object") {
      const { password, token, idToken, ...safeBody } = req.body;
      if (Object.keys(safeBody).length > 0) {
        logContext.body = safeBody;
      }
    }

    logger.error("Internal server error", logContext);
  } else if (statusCode === 429) {
    logger.debug("Rate limit exceeded", logContext);
  } else if (statusCode === 401) {
    logger.debug("Unauthorized", logContext);
  } else if (statusCode >= 400) {
    logger.warn("Client error", logContext);
  }

  // Delegate to zodex-axon for response
  return zodexErrorHandler(err, req, res, next);
};
