import { Router } from "express";
import {
  getUploadUrl,
  updateUserInfoBasedOnAadhaarData,
  getAadhaarUploadConfirmation,
} from "@root/controller/user/aadhaar/index.js";
import { extractAadhaarDataMiddleware } from "@root/middleware/user/aadhaar/extractAadhaarData.middleware.js";
import { userRoutesRESTProtectMiddleware } from "@root/middleware/user/protect/index.js";
import { aadhaarRateLimiter } from "@root/middleware/limiters/index.js";
import { RequestGuardMiddleware } from "zodex-axon/core";
import {
  getAadhaarUploadUrlRequestSchema,
  confirmAadhaarUploadRequestSchema,
} from "@schemas/aadhaar/aadhaar.pipeline.schema.js";

const router = Router();

/**
 * POST /aadhaar/upload-url
 * Get pre-signed URL for uploading Aadhaar image to S3
 * Body: { fileType: "image/jpeg" | "image/png" }
 */
router.use(userRoutesRESTProtectMiddleware);

// All Aadhaar operations are rate limited - expensive AWS calls
router.post(
  "/upload-url",
  aadhaarRateLimiter,
  RequestGuardMiddleware({ body: getAadhaarUploadUrlRequestSchema }),
  getUploadUrl,
);

router.patch(
  "/confirm-upload",
  aadhaarRateLimiter,
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
  aadhaarRateLimiter,
  extractAadhaarDataMiddleware,
  updateUserInfoBasedOnAadhaarData,
);

export { router as aadhaarRouter };
