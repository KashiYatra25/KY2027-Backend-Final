import { z } from "zod";

/**
 * Schema for applying a referral code
 * Used during profile completion
 */
export const applyReferralSchema = z.object({
  referralId: z
    .string()
    .min(1, "Referral ID is required")
    .regex(/^KY27-[A-Z0-9]+$/i, "Invalid referral ID format"),
});

export type ApplyReferralSchemaType = z.infer<typeof applyReferralSchema>;

/**
 * Schema for validating referral ID (query param)
 */
export const validateReferralParamsSchema = z.object({
  referralId: z
    .string()
    .min(1, "Referral ID is required"),
});

export type ValidateReferralParamsSchemaType = z.infer<typeof validateReferralParamsSchema>;
