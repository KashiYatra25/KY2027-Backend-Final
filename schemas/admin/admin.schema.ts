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

/**
 * Query-param schema for GET /admin/teams.
 * Validates pagination and bounds the free-text search field so that
 * unvalidated input can never reach the MongoDB `$regex` query unchecked.
 */
export const getTeamsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(50).optional(),
});

/**
 * Query-param schema for GET /admin/registrations.
 * Validates pagination and bounds all free-text filters so that
 * unvalidated input can never reach the MongoDB query unchecked.
 */
export const getRegistrationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  eventSlug: z
    .string()
    .max(100)
    .regex(/^[a-z0-9-]+$/, "eventSlug must be lowercase alphanumeric with hyphens")
    .optional(),
  status: z.enum(["pending", "confirmed", "cancelled", "waitlisted"]).optional(),
  participationType: z.enum(["individual", "duo", "team"]).optional(),
  search: z.string().max(100).optional(),
});

export type PromoteUserOrAdminRoleRequestSchemaType = z.infer<typeof promoteUserOrAdminRoleRequestSchema>;
export type AdminOnboardingRequestSchemaType = z.infer<typeof adminOnboardingRequestSchema>;
export type AdminAccountStatusChangeRequestSchemaType = z.infer<typeof adminAccountStatusChangeRequestSchema>;
export type AdminLoginRequestSchemaType = z.infer<typeof adminLoginRequestSchema>;
export type GetTeamsQuerySchemaType = z.infer<typeof getTeamsQuerySchema>;
export type GetRegistrationsQuerySchemaType = z.infer<typeof getRegistrationsQuerySchema>;
