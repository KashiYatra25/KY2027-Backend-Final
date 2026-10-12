import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════
// CHANGE PASSWORD SCHEMA
//
// Used by authenticated admins to change their password.
// Requires current password verification before allowing change.
// ═══════════════════════════════════════════════════════════════════

/**
 * Schema for change password request
 * Admin submits current password and new password
 */
export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
});

export type ChangePasswordRequestSchemaType = z.infer<typeof changePasswordRequestSchema>;
