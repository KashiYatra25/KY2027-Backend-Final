import { Router } from "express";
import {
  getUploadUrl,
  extractAadhaarData,
  updateUserInfoBasedOnAdhaarData,
  getAadhaarUploadConfirmation,
} from "@root/controller/user/aadhaar/index.js";
import { restProtectMiddleware } from "@root/controller/middleware/protect/protect.route.factory.middleware.js";
import { aadhaarRateLimiter } from "@middleware/limiters/index.js";
import { RequestGuardMiddleware } from "zodex-axon/core";
import {
  aadhaarUploadUrlSchema,
  confirmAadhaarUploadSchema,
} from "@root/controller/middleware/schemas/aadhaar/aadhaar.pipeline.schema.js";

const router = Router();

/**
 * POST /aadhaar/upload-url
 * Get pre-signed URL for uploading Aadhaar image to S3
 * Body: { fileType: "image/jpeg" | "image/png" }
 */
router.use(restProtectMiddleware);

// All Aadhaar operations are rate limited - expensive AWS calls
router.post(
  "/upload-url",
  aadhaarRateLimiter,
  RequestGuardMiddleware({ body: aadhaarUploadUrlSchema }),
  getUploadUrl,
);

router.patch(
  "/confirm-upload",
  aadhaarRateLimiter,
  RequestGuardMiddleware({ body: confirmAadhaarUploadSchema }),
  getAadhaarUploadConfirmation,
);

/**
 * POST /aadhaar/verify
 * Extract data from uploaded Aadhaar image and save to database
 * Flow: extractAadhaarData (middleware) -> confirmAadhaar
 * - Extracts data using Textract
 * - Saves verified data to Prisma (User)
 * - Updates MongoDB (AccountProgress.hasAadhaarVerified)
 * - Deletes S3 image after verification
 */
router.post(
  "/extract-details-and-update-profile",
  aadhaarRateLimiter,
  extractAadhaarData,
  updateUserInfoBasedOnAdhaarData,
);

export { router as aadhaarRouter };
