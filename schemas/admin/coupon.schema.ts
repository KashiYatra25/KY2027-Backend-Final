import { z } from "zod";

/**
 * Schema for creating a new coupon
 */
export const createCouponRequestSchema = z
  .object({
    code: z
      .string()
      .min(3, "Coupon code must be at least 3 characters")
      .max(20, "Coupon code must be at most 20 characters")
      .toUpperCase()
      .regex(
        /^[A-Z0-9_-]+$/,
        "Coupon code can only contain letters, numbers, underscores, and hyphens"
      ),

    description: z.string().max(500).optional(),

    type: z.enum(["PERCENTAGE", "FIXED"], {
      message: "Type must be either PERCENTAGE or FIXED",
    }),

    value: z.number().positive("Value must be positive"),

    maxUsageCount: z.number().int().positive().optional(),
    maxUsagePerUser: z.number().int().positive().default(1),

    validFrom: z.string().datetime().optional(),
    validUntil: z.string().datetime().optional(),

    applicablePassIds: z.array(z.string()).default([]),
  })
  .refine(
    (data) => {
      // If type is PERCENTAGE, value must be <= 100
      if (data.type === "PERCENTAGE" && data.value > 100) {
        return false;
      }
      return true;
    },
    {
      message: "Percentage discount cannot exceed 100%",
      path: ["value"],
    }
  )
  .refine(
    (data) => {
      // If validUntil is provided, it must be after validFrom
      if (data.validFrom && data.validUntil) {
        return new Date(data.validUntil) > new Date(data.validFrom);
      }
      return true;
    },
    {
      message: "Valid until date must be after valid from date",
      path: ["validUntil"],
    }
  );

export type CreateCouponRequestSchemaType = z.infer<typeof createCouponRequestSchema>;
