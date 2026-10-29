import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════
// ZONAL EVENT SCHEMAS
// ═══════════════════════════════════════════════════════════════════

/**
 * Params schema for zonal event routes
 * Used for /:collegeSlug/events/:eventSlug/...
 */
export const zonalEventParamsRequestSchema = z.object({
  collegeSlug: z
    .string()
    .min(1, "College slug is required")
    .max(100, "College slug too long")
    .regex(/^[a-z0-9-]+$/, "College slug must be lowercase alphanumeric with hyphens"),
  eventSlug: z
    .string()
    .min(1, "Event slug is required")
    .max(100, "Event slug too long")
    .regex(/^[a-z0-9-]+$/, "Event slug must be lowercase alphanumeric with hyphens"),
});

export type ZonalEventParamsRequestSchemaType = z.infer<typeof zonalEventParamsRequestSchema>;
