import { z } from "zod";

export const promoteUserOrAdminRoleRequestSchema = z.object({
  targetEmail: z.email("Invalid email address"),
  role: z.enum(["MANAGER", "OPERATOR"]),
});

export const adminOnboardingRequestSchema = z.object({
  email: z.email("Invalid email address"),
  adminPassword: z.string().min(8, "Password must be at least 8 characters long"),
  loginToken: z.string().min(32, "Invalid login token"),
});

export const adminAccountStatusChangeRequestSchema = z.object({
  targetEmail: z.email("Invalid email address"),
  action: z.enum(["SUSPEND", "REACTIVATE"]),
  reason: z.string().min(10, "Reason must be at least 10 characters long").optional(),
});

/**
 * Schema for standalone admin login (email + password)
 * Used when admin has no NextAuth session but knows their credentials.
 */
export const adminLoginRequestSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type PromoteUserOrAdminRoleRequestSchemaType = z.infer<typeof promoteUserOrAdminRoleRequestSchema>;
export type AdminOnboardingRequestSchemaType = z.infer<typeof adminOnboardingRequestSchema>;
export type AdminAccountStatusChangeRequestSchemaType = z.infer<typeof adminAccountStatusChangeRequestSchema>;
export type AdminLoginRequestSchemaType = z.infer<typeof adminLoginRequestSchema>;
