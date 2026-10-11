import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════
// AUTHENTICATION SCHEMAS
// ═══════════════════════════════════════════════════════════════════

/**
 * User authentication via Google OAuth
 *
 * SECURITY: We now require the Google ID token for server-side verification
 * instead of trusting client-supplied user data.
 *
 * The backend will:
 * 1. Verify the idToken with Google's servers
 * 2. Extract verified user data (sub, email, name, picture)
 * 3. Use only verified data for user creation/updates
 */
export const userAuthenticationRequestSchema = z.object({
  idToken: z.string().min(100, "Invalid Google ID token"),
});

export const gqlUserVerificationRequestSchema = z.object({
  id: z.string().min(1, "User ID is required"),
  email: z.email("Invalid email address"),
});

export type UserAuthenticationRequestSchemaType = z.infer<typeof userAuthenticationRequestSchema>;
export type GqlUserVerificationRequestSchemaType = z.infer<typeof gqlUserVerificationRequestSchema>;
