import type { AdminCredVerificationSchemaType } from "@root/controller/middleware/schemas/admin/admin.schema";
import type { AdminAuthRequestWithAdminData } from "@root/controller/middleware/admin/auth";
import { CryptoService } from "@root/utils/helper/crypto.encryption.helper";
import type { Response } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { BadRequest } from "zodex-axon/errors";
import { OkResponseStrategy } from "zodex-axon/responses";

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
      throw new BadRequest();
    }

    // TODO: Send email for OTP verification

    new OkResponseStrategy().handleResponse(res, {
      info: "Admin credentials verified successfully",
      success: true,
    });
  },
);
