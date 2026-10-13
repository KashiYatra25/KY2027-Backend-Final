import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════
// SCHEDULE SCHEMAS (public)
// ═══════════════════════════════════════════════════════════════════

export const venueSlugParamSchema = z.object({
  venueSlug: z
    .string()
    .min(1, "Venue slug is required")
    .max(100, "Venue slug too long")
    .regex(/^[a-z0-9-]+$/, "Venue slug must be lowercase alphanumeric with hyphens"),
});

export type VenueSlugParamSchemaType = z.infer<typeof venueSlugParamSchema>;
