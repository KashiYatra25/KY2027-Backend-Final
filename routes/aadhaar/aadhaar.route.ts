import { Router } from "express";
import {
  getUploadUrl,
  extractAadhaarData,
  updateUserInfoBasedOnAdhaarData,
  getAdhaarUploadConfirmation,
} from "@root/controller/user/aadhaar/index.js";
import { restProtectMiddleware } from "@root/controller/middleware/protect/protect.route.factory.middleware.js";
import { RequestGuardMiddleware } from "zodex-axon/core";
import {
  adhaarUploadUrlSchema,
  confirmAdhaarUploadSchema,
} from "@root/controller/middleware/schemas/adhaar/adhaar.pipeline.schema.js";

const router = Router();

/**
 * POST /aadhaar/upload-url
 * Get pre-signed URL for uploading Aadhaar image to S3
 * Body: { fileType: "image/jpeg" | "image/png" }
 */
router.use(restProtectMiddleware);
router.post(
  "/upload-url",
  RequestGuardMiddleware({ body: adhaarUploadUrlSchema }),
  getUploadUrl,
);

router.patch(
  "/confirm-upload",
  RequestGuardMiddleware({ body: confirmAdhaarUploadSchema }),
  getAdhaarUploadConfirmation,
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
  extractAadhaarData,
  updateUserInfoBasedOnAdhaarData,
);

export { router as aadhaarRouter };
