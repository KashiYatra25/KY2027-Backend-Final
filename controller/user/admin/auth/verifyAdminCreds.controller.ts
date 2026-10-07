import type { AdminCredVerificationSchemaType } from "@schemas/admin/admin.schema.js";
import type { AdminAuthRequestWithAdminData } from "@middleware/admin/auth/types.js";
import { CryptoService } from "@root/utils/helper/crypto.encryption.helper";
import type { Response } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { BadRequest } from "zodex-axon/errors";
import { OkResponseStrategy } from "zodex-axon/responses";
import { logger } from "@logger/index.js";

/**
 * Verify admin credentials (password)
 */
export const verifyAdminCreds = catchAsync(
  async (
    req: VerifiedRequest<
      { body: AdminCredVerificationSchemaType },
      AdminAuthRequestWithAdminData
    >,
    res: Response,
  ) => {
    const { adminPassword } = req.validatedData;
    const { hashedPassword } = req.adminData;

    const isPasswordValid = await CryptoService.verify(
      adminPassword,
      hashedPassword,
    );

    if (!isPasswordValid) {
      logger.warn("Admin credential verification failed", {
        userId: req.user.id,
        adminId: req.adminData.adminId,
      });
      throw new BadRequest();
    }

    logger.info("Admin credentials verified", {
      userId: req.user.id,
      adminId: req.adminData.adminId,
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Admin credentials verified successfully",
      success: true,
    });
  },
);
