// ═══════════════════════════════════════════════════════════════════
// GOOGLE OAUTH SERVICE
//
// Verifies Google ID tokens server-side to prevent identity spoofing.
// ═══════════════════════════════════════════════════════════════════

export {
  initializeGoogleOAuthClient,
  isGoogleOAuthInitialized,
  verifyGoogleIdToken,
} from "./helper/functions/index.js";

export type { VerifiedGoogleUser } from "./helper/types/index.js";
