import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════
// AUTHENTICATION SCHEMAS
// Based on NextAuth Google Provider - synced with frontend
// ═══════════════════════════════════════════════════════════════════

/**
 * User data received from Google OAuth via frontend
 * slugName is extracted from email on frontend (e.g., srajan.saxena@gmail.com → srajan.saxena)
 * SYNC WITH: frontend/lib/api/utils/auth.schema.ts
 */
export const userAuthSchema = z.object({
  id: z.string().min(1, "User ID is required"),
  email: z.email("Invalid email address"),
  slugName: z.string().min(1, "Slug name is required"),
  avatarUrl: z.url().optional(),
});


// Currently we are not allowing any phone number changes
// export const changePhoneNumberSchema = z.object({
//   newPhoneNumber: z
//     .string()
//     .min(10, "Phone number must be at least 10 digits")
//     .max(15, "Phone number must be at most 15 digits"),
// });

// export type ChangePhoneNumberSchemaType = z.infer<
//   typeof changePhoneNumberSchema
// >;

export const gqlUserVerificationSchema = z.object({
  id: z.string().min(1, "User ID is required"),
  email: z.email("Invalid email address"),
});

export type UserAuthSchemaType = z.infer<typeof userAuthSchema>;
export type GqlUserVerificationSchemaType = z.infer<
  typeof gqlUserVerificationSchema
>;
