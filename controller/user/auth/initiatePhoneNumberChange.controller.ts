import { OkResponseStrategy } from "zodex-axon/responses";
import type { Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { CryptoService } from "@helper/crypto.encryption.helper.js";
import { catchAsync } from "zodex-axon/core";
import { type AuthenticatedUserRequestWithVerifiedEmail } from "@helper/auth.types.helper.js";
import { env } from "@lib/env/environment.js";
import { VerificationTokenModel } from "@lib/mongo/index.js";
import { InternalServerError } from "zodex-axon/errors";

/**
 * Initiate phone number change - generates CSRF token
 */
export const initiatePhoneNumberChange = catchAsync(
  async (
    req: AuthenticatedUserRequestWithVerifiedEmail,
    res: Response,
  ) => {
    const { id: userId } = req.user;

    const randomTokenSalt = crypto.randomBytes(16).toString("hex");
    const encryptedCSRFToken = CryptoService.encrypt(randomTokenSalt);
    const hashedCSRFToken = await bcrypt.hash(encryptedCSRFToken, 10);

    const csrfTokenDoc = await VerificationTokenModel.create({
      userId,
      tokenType: "CSRF_TOKEN",
      tokenValue: hashedCSRFToken,
      expiresAt: new Date(Date.now() + Number(env.CSRF_TOKEN_EXPIRATION_TIME)),
    });

    if (!csrfTokenDoc) {
      throw new InternalServerError();
    }

    res.setHeader(env.CSRF_TOKEN_HEADER_NAME, encryptedCSRFToken);

    new OkResponseStrategy().handleResponse(res, {
      info: "Phone Number change initiation successful.",
    });
  },
);
