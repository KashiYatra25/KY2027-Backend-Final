import { Router } from "express";
import {
  getUploadUrl,
  updateUserInfoBasedOnAadhaarData,
  getAadhaarUploadConfirmation,
} from "@root/controller/user/aadhaar/index.js";
import { extractAadhaarDataMiddleware } from "@root/middleware/user/aadhaar/extractAadhaarData.middleware.js";
import { aadhaarPipelineLockMiddleware } from "@root/middleware/user/aadhaar/aadhaarPipelineLock.middleware.js";
import { userRoutesRESTProtectMiddleware } from "@root/middleware/user/protect/index.js";
import { checkUserAccountStatusMiddleware } from "@middleware/user/protect/checkUserStatus.middleware.js";
import { aadhaarRateLimiterMiddleware } from "@root/middleware/limiters/index.js";
import { RequestGuardMiddleware } from "zodex-axon/core";
import {
  getAadhaarUploadUrlRequestSchema,
  confirmAadhaarUploadRequestSchema,
} from "@schemas/aadhaar/aadhaar.schema.js";

const router = Router();

// ═══════════════════════════════════════════════════════════════════
// PROTECTED ROUTES
// All routes below require:
// 1. Valid NextAuth session (userRoutesRESTProtectMiddleware)
// 2. Active account status (checkUserAccountStatusMiddleware) - SEC-006 FIX
// ═══════════════════════════════════════════════════════════════════

router.use(userRoutesRESTProtectMiddleware);
router.use(checkUserAccountStatusMiddleware); // SEC-006: Block suspended users

// Aadhaar auto-upload (S3 + Textract) is disabled while AWS is unavailable.
// This lock blocks ALL upload/confirm/extract endpoints below with a clear
// error so the broken pipeline can never be reached. Users use manual entry.
// To re-enable: flip AADHAAR_PIPELINE_ENABLED in the lock middleware.
router.use(aadhaarPipelineLockMiddleware);

/**
 * POST /aadhaar/upload-url
 * Get pre-signed URL for uploading Aadhaar image to S3
 * Body: { fileType: "image/jpeg" | "image/png" }
 */
router.post(
  "/upload-url",
  aadhaarRateLimiterMiddleware,
  RequestGuardMiddleware({ body: getAadhaarUploadUrlRequestSchema }),
  getUploadUrl,
);

router.patch(
  "/confirm-upload",
  aadhaarRateLimiterMiddleware,
  RequestGuardMiddleware({ body: confirmAadhaarUploadRequestSchema }),
  getAadhaarUploadConfirmation,
);

/**
 * POST /aadhaar/verify
 * Extract data from uploaded Aadhaar image and save to database
 * Flow: extractAadhaarDataMiddleware (middleware) -> confirmAadhaar
 * - Extracts data using Textract
 * - Saves verified data to Prisma (User)
 * - Updates MongoDB (AccountProgress.hasAadhaarVerified)
 * - Deletes S3 image after verification
 */
router.post(
  "/extract-details-and-update-profile",
  aadhaarRateLimiterMiddleware,
  extractAadhaarDataMiddleware,
  updateUserInfoBasedOnAadhaarData,
);

export { router as aadhaarRouter };
