import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════
// FORGOT PASSWORD SCHEMAS
// ═══════════════════════════════════════════════════════════════════

/**
 * Schema for forgot password request
 * User submits email to receive reset link
 */
export const forgotPasswordRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export type ForgotPasswordRequestSchemaType = z.infer<typeof forgotPasswordRequestSchema>;

/**
 * Schema for reset password request
 * User submits token, email, and new password
 */
export const resetPasswordRequestSchema = z.object({
  token: z.string().min(1, "Token is required"),
  email: z.string().email("Invalid email address"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
});

export type ResetPasswordRequestSchemaType = z.infer<typeof resetPasswordRequestSchema>;
