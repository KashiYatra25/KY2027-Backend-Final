// ═══════════════════════════════════════════════════════════════════
// USER PURCHASES TYPES
// Types for user purchases controllers
// ═══════════════════════════════════════════════════════════════════

/**
 * Body for submitManualPayment endpoint
 */
export interface SubmitManualPaymentBody {
  passType: string;
  transactionId: string;
  paymentMethod: "upi" | "bank_transfer" | "cash" | "other";
  paymentScreenshotS3Key?: string;
  paymentNote?: string;
}
