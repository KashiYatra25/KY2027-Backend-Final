import type { TokenPayload } from "google-auth-library";
import { logger } from "@logger/logger.js";
import type { VerifiedGoogleUser } from "@services/google/helper/types/index.js";
import { getOAuthClient } from "./client.helper.js";

/**
 * Verify a Google ID token and extract verified user data
 *
 * @param idToken - The Google ID token from the client
 * @returns Verified user data or null if verification fails
 *
 * @example
 * const user = await verifyGoogleIdToken(idToken);
 * if (!user) {
 *   throw new UnauthorizedAccess("Invalid Google token");
 * }
 * // user.id, user.email are now verified by Google
 */
export async function verifyGoogleIdToken(
  idToken: string
): Promise<VerifiedGoogleUser | null> {
  const oauthClient = getOAuthClient();

  if (!oauthClient) {
    logger.error("Google OAuth client not initialized");
    throw new Error(
      "Google OAuth client not initialized. Call initializeGoogleOAuthClient() first."
    );
  }

  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: oauthClient._clientId,
    });

    const payload: TokenPayload | undefined = ticket.getPayload();

    if (!payload) {
      logger.warn("Google ID token verification failed - no payload");
      return null;
    }

    // Ensure email is present and verified
    if (!payload.email) {
      logger.warn("Google ID token missing email claim");
      return null;
    }

    if (!payload.email_verified) {
      logger.warn("Google ID token email not verified", {
        email: payload.email,
      });
      return null;
    }

    const verifiedUser: VerifiedGoogleUser = {
      id: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified ?? false,
      name: payload.name ?? null,
      givenName: payload.given_name ?? null,
      familyName: payload.family_name ?? null,
      picture: payload.picture ?? null,
      hostedDomain: payload.hd ?? null,
    };

    logger.debug("Google ID token verified successfully", {
      userId: verifiedUser.id,
      email: verifiedUser.email,
    });

    return verifiedUser;
  } catch (error) {
    logger.warn("Google ID token verification failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}
