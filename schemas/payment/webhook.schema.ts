import { z } from "zod";

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
    status: z.string().min(1, "Status is required"),
    amount_paise: z.number().int(),
    paid_at: z.string().optional(),
  })
  .transform((data) => ({
    orderId: data.order_id,
    status: data.status,
    amountPaise: data.amount_paise,
    paidAt: data.paid_at,
  }));

export type PaymentWebhookRequestSchemaType = z.output<typeof paymentWebhookRequestSchema>;
