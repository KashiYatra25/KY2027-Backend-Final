import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════
// MANUAL PAYMENT REQUEST SCHEMAS
// ═══════════════════════════════════════════════════════════════════

/**
 * User object in manual payment request
 */
const manualPaymentUserSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  kyId: z.string().min(1, "KY ID is required"),
  email: z.string().email("Invalid email address"),
});

/**
 * Schema for creating a manual payment request
 */
export const createManualPaymentRequestSchema = z.object({
  users: z
    .array(manualPaymentUserSchema)
    .min(1, "At least one user is required")
    .max(100, "Maximum 100 users per request"),
  passType: z.enum(["DARBAR", "YATRI", "SWARNIM", "ZONAL_SINGLE", "ZONAL_MULTI"]),
  collegeSlug: z.string().max(50).optional(),
  paymentMethod: z.enum(["UPI", "NETBANKING", "WALLET", "CASH"]),
  amount: z.number().min(0, "Amount must be non-negative"),
  bonafides: z.array(z.string()).optional(),
});

/**
 * Schema for approving a manual payment request
 */
export const approveManualPaymentRequestSchema = z.object({
  note: z.string().max(500).optional(),
});

/**
 * Schema for rejecting a manual payment request
 */
export const rejectManualPaymentRequestSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required").max(500),
});

/**
 * Schema for getting presigned upload URLs
 */
export const getPresignedUploadUrlsSchema = z.object({
  files: z
    .array(
      z.object({
        filename: z.string().min(1, "Filename is required").max(255),
        contentType: z.enum([
          "image/jpeg",
          "image/jpg",
          "image/png",
          "application/pdf",
        ]),
      }),
    )
    .min(1, "At least one file is required")
    .max(10, "Maximum 10 files per request"),
});

/**
 * Query schema for listing manual payment requests
 */
export const getManualPaymentRequestsQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// Export types
export type CreateManualPaymentRequestSchemaType = z.infer<typeof createManualPaymentRequestSchema>;
export type ApproveManualPaymentRequestSchemaType = z.infer<typeof approveManualPaymentRequestSchema>;
export type RejectManualPaymentRequestSchemaType = z.infer<typeof rejectManualPaymentRequestSchema>;
export type GetPresignedUploadUrlsSchemaType = z.infer<typeof getPresignedUploadUrlsSchema>;
export type GetManualPaymentRequestsQuerySchemaType = z.infer<typeof getManualPaymentRequestsQuerySchema>;
