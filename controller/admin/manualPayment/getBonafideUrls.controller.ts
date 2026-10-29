import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound } from "zodex-axon/errors";
import { ManualPaymentRequestModel } from "@root/databaseManagers/mongoose/index.js";
import { r2 } from "@root/services/r2/instance.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";
import type { ManualPaymentRequestIdParamRequestSchemaType } from "@schemas/admin/manualPayment.schema.js";

// ═══════════════════════════════════════════════════════════════════
// GET BONAFIDE URLS
// 
// Generate presigned download URLs for bonafide files.
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /admin/manual-payment/requests/:requestId/bonafides
 * Get presigned download URLs for bonafide files
 */
export const getBonafideUrls = catchAsync(
  async (
    req: VerifiedRequest<
      { params: ManualPaymentRequestIdParamRequestSchemaType },
      AdminRequestWithVerifiedCreds
    >,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { requestId } = req.validatedParams;

    // Find the request
    const request = await ManualPaymentRequestModel.findOne({ requestId }).lean();

    if (!request) {
      new NotFound().handleResponse(res, {
        info: "Payment request not found",
      });
      return;
    }

    // Generate presigned URLs for each bonafide
    const bonafideUrls = await Promise.all(
      request.bonafides.map(async (key, index) => {
        const { downloadUrl, expiresAt } = await r2.generateDownloadUrl(key, 3600); // 1 hour expiry
        
        // Determine file type from key
        const extension = key.split('.').pop()?.toLowerCase() || 'unknown';
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension);
        
        return {
          index,
          key,
          url: downloadUrl,
          expiresAt: expiresAt.toISOString(),
          isImage,
          extension,
        };
      }),
    );

    new OkResponseStrategy().handleResponse(res, {
      info: "Bonafide URLs generated successfully",
      requestId,
      bonafides: bonafideUrls,
    });
  },
);
