import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest } from "zodex-axon/errors";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";
import { r2 } from "@root/services/r2/instance.js";

// ═══════════════════════════════════════════════════════════════════
// GET PRESIGNED UPLOAD URLS
// 
// Returns presigned URLs for uploading bonafide/payment proof files to R2.
// Admin uploads directly to R2, then includes the keys in the request.
// ═══════════════════════════════════════════════════════════════════

interface GetPresignedUrlsBody {
  files: Array<{
    filename: string;
    contentType: string;
  }>;
}

/**
 * POST /admin/uploads/presign
 * Get presigned URLs for uploading files to R2
 * 
 * Body:
 * - files: Array<{ filename: string, contentType: string }>
 * 
 * Returns:
 * - uploads: Array<{ filename, uploadUrl, key, expiresAt }>
 */
export const getPresignedUploadUrls = catchAsync(
  async (
    req: VerifiedRequest<{ body: GetPresignedUrlsBody }, AdminRequestWithVerifiedCreds>,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { files } = req.validatedData;
    const adminId = req.admin.adminId;

    // Validate files array
    if (!files || !Array.isArray(files) || files.length === 0) {
      new BadRequest().handleResponse(res, {
        info: "At least one file is required",
      });
      return;
    }

    if (files.length > 10) {
      new BadRequest().handleResponse(res, {
        info: "Maximum 10 files allowed per request",
      });
      return;
    }

    // Validate file types
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/pdf",
    ];

    for (const file of files) {
      if (!allowedTypes.includes(file.contentType)) {
        new BadRequest().handleResponse(res, {
          info: `Invalid file type: ${file.contentType}. Allowed: JPG, PNG, PDF`,
        });
        return;
      }
    }

    // Generate presigned URLs for all files
    const result = await r2.generateBatchUploadUrls(
      {
        files,
        folder: "manual-payment-bonafides",
        identifier: adminId,
      },
      600, // 10 minutes expiry
    );

    new OkResponseStrategy().handleResponse(res, {
      info: "Presigned URLs generated successfully",
      uploads: result.uploads.map((u) => ({
        filename: u.filename,
        uploadUrl: u.uploadUrl,
        key: u.key,
        expiresAt: u.expiresAt.toISOString(),
      })),
    });
  },
);
