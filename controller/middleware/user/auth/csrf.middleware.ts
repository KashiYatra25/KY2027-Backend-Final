import bcrypt from "bcryptjs";
import { CryptoService } from "@helper/crypto.encryption.helper.js";
import { env } from "@lib/env/environment.js";
import { VerificationTokenModel } from "@lib/mongo/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/auth.types.helper.js";
import type { NextFunction, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { BadRequest } from "zodex-axon/errors";

/**
 * Middleware to validate CSRF token for sensitive operations
 */
export const validateCSRFToken = catchAsync(
  async (
    req: AuthenticatedUserRequestWithVerifiedEmail,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { id: userId } = req.user;
    const csrfToken = req.headers[env.CSRF_TOKEN_HEADER_NAME];

    if (!csrfToken || typeof csrfToken !== "string") {
      return next(
        new BadRequest().handleResponse(res, {
          info: "CSRF token is missing or invalid.",
        }),
      );
    }

    const csrfTokenDoc = await VerificationTokenModel.findOne({
      userId,
      tokenType: "CSRF_TOKEN",
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .select("+tokenValue");

    if (!csrfTokenDoc) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Invalid or expired CSRF token.",
        }),
      );
    }

    const decryptedCSRFToken = CryptoService.decrypt(csrfToken);
    const isValid = await bcrypt.compare(
      decryptedCSRFToken,
      csrfTokenDoc.tokenValue,
    );

    if (!isValid) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Invalid CSRF token.",
        }),
      );
    }

    next();
  },
);
