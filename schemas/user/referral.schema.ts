import { z } from "zod";

/**
 * Schema for validating referral ID (query param)
 */
export const addReferralIdRequestSchema = z.object({
  referralId: z.string().min(1, "Referral ID is required"),
});

export type AddReferralIdRequestSchemaType = z.infer<typeof addReferralIdRequestSchema>;
