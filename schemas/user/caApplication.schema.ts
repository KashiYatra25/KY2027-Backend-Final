import { z } from "zod";

/**
 * Schema for CA application creation
 * User just needs to apply - no additional data required for now
 * Can be extended later with motivation, social links, etc.
 */
export const becomeCaRequestSchema = z.object({
  // Optional fields that can be added later:
  // motivation: z.string().min(50).max(1000).optional(),
  // instagramHandle: z.string().optional(),
  // followers: z.number().optional(),
});

export type BecomeCaRequestSchemaType = z.infer<typeof becomeCaRequestSchema>;
