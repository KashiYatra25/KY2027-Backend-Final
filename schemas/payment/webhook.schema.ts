import { z } from "zod";

/**
 * Allowed payment statuses the Go service may report.
 * Go maps Cashfree states to these canonical values before notifying Node.
 * Enum-validated so unexpected/garbage statuses are rejected at the edge
 * instead of being blindly persisted.
 */
export const PAYMENT_WEBHOOK_STATUSES = ["PAID", "FAILED", "EXPIRED"] as const;

export type PaymentWebhookStatus = (typeof PAYMENT_WEBHOOK_STATUSES)[number];

/**
 * Schema for payment webhook notification from Go payment service
 * Called when payment status changes (success/failure)
 *
 * Go sends snake_case (NotifyNodeArgs in internal/jobs/notify_node.go),
 * we transform to camelCase for consistent TypeScript usage.
 */
export const paymentWebhookRequestSchema = z
  .object({
    order_id: z.string().min(1, "Order ID is required"),
    // Normalise casing before enum validation so "paid"/"PAID" both work,
    // while still rejecting any value outside the known set.
    status: z
      .string()
      .min(1, "Status is required")
      .transform((s) => s.toUpperCase())
      .pipe(z.enum(PAYMENT_WEBHOOK_STATUSES)),
    amount_paise: z.number().int().nonnegative("Amount must be non-negative"),
    paid_at: z.string().optional(),
  })
  .transform((data) => ({
    orderId: data.order_id,
    status: data.status,
    amountPaise: data.amount_paise,
    paidAt: data.paid_at,
  }));

export type PaymentWebhookRequestSchemaType = z.output<typeof paymentWebhookRequestSchema>;
