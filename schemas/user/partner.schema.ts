import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════
// BECOME PARTNER SCHEMA
// Validates submissions from the sponsors page "Partner With Us" form.
// ═══════════════════════════════════════════════════════════════════

export const becomePartnerRequestSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  email: z.string().email("Invalid email address").max(254),
});

export type BecomePartnerRequestSchemaType = z.infer<typeof becomePartnerRequestSchema>;
