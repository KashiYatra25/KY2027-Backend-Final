import bcrypt from "bcryptjs";
import { CryptoService } from "@helper/functions/crypto.helper.js";
import { env } from "@lib/env/environment.js";
import { logger } from "@logger/logger.js";
import { VerificationTokenModel } from "@lib/mongo/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import type { NextFunction, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { BadRequest } from "zodex-axon/errors";

/**
 * Middleware to validate CSRF token for sensitive operations
 */
export const validateCSRFTokenMiddleware = catchAsync(
  async (
    req: AuthenticatedUserRequestWithVerifiedEmail,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { id: userId } = req.user;
    const csrfToken = req.headers[env.CSRF_TOKEN_HEADER_NAME];

    if (!csrfToken || typeof csrfToken !== "string") {
      logger.warn("CSRF token missing", { userId });
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
      logger.warn("CSRF token not found or expired", { userId });
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
      logger.warn("CSRF token invalid signature", { userId });
      return next(
        new BadRequest().handleResponse(res, {
          info: "Invalid CSRF token.",
        }),
      );
    }

    logger.debug("CSRF token validated", { userId });
    next();
  },
);
