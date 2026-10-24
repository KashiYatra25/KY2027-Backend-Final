import { logger } from "@logger/logger.js";
import type { ErrorRequestHandler } from "express";
import { globalErrorHandler as zodexErrorHandler } from "zodex-axon/errors";
import { metrics } from "@services/metrics/index.js";

/**
 * Patterns that indicate an internal error message that should not be exposed.
 * These are logged but sanitized before sending to the client.
 */
const SENSITIVE_ERROR_PATTERNS = [
  /prisma/i,
  /mongo/i,
  /redis/i,
  /econnrefused/i,
  /etimedout/i,
  /enotfound/i,
  /socket/i,
  /tcp/i,
  /connection/i,
  /database/i,
  /query/i,
  /constraint/i,
  /foreign key/i,
  /unique constraint/i,
  /duplicate key/i,
  /aws/i,
  /s3/i,
  /textract/i,
  /secret/i,
  /credential/i,
  /password/i,
  /token/i,
];

/**
 * Check if an error message contains sensitive internal details
 */
function isSensitiveError(message: string): boolean {
  return SENSITIVE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Custom error handler that:
 * 1. Logs all errors to Loki (zodex-axon doesn't log)
 * 2. Sanitizes sensitive error messages before sending to client
 */
export const globalErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const isServerError = statusCode >= 500;

  // Build detailed context for tracing
  const logContext: Record<string, unknown> = {
    requestId: req.requestId || "none",
    statusCode,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  };

  // Add error details for logging (full details - internal only)
  if (err.message) logContext.error = err.message;
  if (err.name && err.name !== "Error") logContext.errorType = err.name;
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

    // Record error metric
    metrics.recordError(err.name || "internal");

    // SANITIZE: Don't expose internal error details to client
    // Only sanitize non-operational errors (operational errors are intentional user-facing messages)
    if (!err.isOperational && err.message && isSensitiveError(err.message)) {
      err.message = "An internal error occurred. Please try again later.";
      // Clear any sensitive data that might leak
      delete err.stack;
      delete err.cause;
    }
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
