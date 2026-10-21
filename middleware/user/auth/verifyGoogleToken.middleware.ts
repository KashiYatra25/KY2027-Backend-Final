import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { UnauthorizedAccess } from "zodex-axon/errors";
import { logger } from "@logger/logger.js";
import { verifyGoogleIdToken } from "@services/google/googleOAuth.service.js";
import type { UserAuthenticationRequestSchemaType } from "@schemas/user/auth.schema.js";
import type { GoogleVerifiedRequest } from "./helper/types/google.types.js";

/**
 * Middleware to verify Google ID token and attach verified user data to request.
 *
 * Extracts idToken from validated request body, verifies with Google's servers,
 * and attaches the verified user data to req.googleData.
 *
 * Must be used after Zod validation middleware for UserAuthenticationRequestSchemaType.
 *
 * @example
 * router.post("/auth",
 *   validate(userAuthSchema),
 *   verifyGoogleTokenMiddleware,
 *   authenticateUser
 * );
 */
export const verifyGoogleTokenMiddleware = catchAsync(
  async (
    req: VerifiedRequest<{ body: UserAuthenticationRequestSchemaType }>,
    res: Response,
    next: NextFunction,
  ) => {
    const { idToken } = req.validatedData;

    const verifiedUser = await verifyGoogleIdToken(idToken);

    if (!verifiedUser) {
      logger.warn("Authentication failed - invalid Google ID token", {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      return next(
        new UnauthorizedAccess().handleResponse(res, {
          info: "Invalid or expired Google authentication token",
          code: "INVALID_GOOGLE_TOKEN",
        }),
      );
    }

    // Attach verified Google data to request
    (req as unknown as GoogleVerifiedRequest).googleData = verifiedUser;

    logger.debug("Google ID token verified", {
      userId: verifiedUser.id,
      email: verifiedUser.email,
    });

    next();
  },
);
