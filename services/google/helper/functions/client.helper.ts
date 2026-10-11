import { OAuth2Client } from "google-auth-library";
import { logger } from "@logger/logger.js";

let oauthClient: OAuth2Client | null = null;

/**
 * Initialize the OAuth client with Google Client ID
 * Should be called once at server startup
 */
export function initializeGoogleOAuthClient(clientId: string): void {
  oauthClient = new OAuth2Client(clientId);
  logger.info("Google OAuth client initialized");
}

/**
 * Get the OAuth client instance
 * Returns null if not initialized
 */
export function getOAuthClient(): OAuth2Client | null {
  return oauthClient;
}

/**
 * Check if the OAuth client is initialized
 */
export function isGoogleOAuthInitialized(): boolean {
  return oauthClient !== null;
}
