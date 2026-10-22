import type { Request, Response, NextFunction } from "express";
import { ForbiddenErrorResponse } from "zodex-axon/errors";
import { logger } from "@logger/logger.js";

// ═══════════════════════════════════════════════════════════════════
// AADHAAR AUTO-UPLOAD PIPELINE LOCK
// ═══════════════════════════════════════════════════════════════════
//
// The Aadhaar auto-upload flow depends on AWS S3 (pre-signed uploads) and
// AWS Textract (OCR extraction). While AWS access is unavailable, Textract
// cannot run, so this entire pipeline is DISABLED server-side. Users must
// use the Manual Entry flow instead (POST /user/profile/manual-identity),
// which does not touch AWS.
//
// This is the single server-side toggle. To re-enable the auto-upload
// pipeline once AWS access is restored, flip this back to `true`.
export const AADHAAR_PIPELINE_ENABLED = false;

/**
 * Blocks every Aadhaar auto-upload endpoint with a 503 while the pipeline is
 * disabled. Mounted ahead of the upload/confirm/extract handlers so no request
 * can reach the (currently non-functional) S3 + Textract code paths.
 */
export function aadhaarPipelineLockMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (AADHAAR_PIPELINE_ENABLED) {
    return next();
  }

  logger.warn("Blocked Aadhaar auto-upload: pipeline disabled (AWS/Textract unavailable)", {
    path: req.originalUrl,
    method: req.method,
  });

  return next(
    new ForbiddenErrorResponse().handleResponse(res, {
      info: "Aadhaar auto-upload is temporarily unavailable. Please use manual identity entry instead.",
      disabled: true,
    }),
  );
}
