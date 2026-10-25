// ═══════════════════════════════════════════════════════════════════
// PURCHASES TYPES
// Types for admin purchases controllers
// ═══════════════════════════════════════════════════════════════════

/**
 * Query parameters for getAllPurchases endpoint
 */
export interface GetPurchasesQuery {
  status?: string;
  source?: string;
  search?: string;
  page?: string;
  limit?: string;
}

/**
 * Pass benefits configuration for creating/verifying passes
 */
export interface PassBenefitsInput {
  // Core access
  festivalEntry?: boolean;
  allDaysAccess?: boolean;

  // Pro-nite access
  proNiteAccess?: boolean;
  proNiteSeating?: "none" | "general" | "priority" | "vip";

  // Merchandise & goodies
  welcomeKit?: boolean;
  tshirt?: boolean;
  merchandise?: boolean;

  // Food & hospitality
  mealsIncluded?: number;
  refreshments?: boolean;

  // Special access
  backstageAccess?: boolean;
  workshopAccess?: boolean;
  meetAndGreet?: boolean;

  // Accommodation
  accommodationIncluded?: boolean;
  accommodationType?: string;

  // Custom benefits
  custom?: Array<{
    name: string;
    description?: string;
    value?: unknown;
  }>;
}

/**
 * Body for createComplimentaryPass endpoint
 */
export interface CreateComplimentaryPassBody {
  userId: string;
  passType: string;
  benefits: PassBenefitsInput;
  reason: string;
}

/**
 * Body for verifyManualPayment endpoint
 */
export interface VerifyPaymentBody {
  purchaseId: string;
  passType: string;
  amountPaid: number;
  benefits: PassBenefitsInput;
  verificationNote?: string;
}

/**
 * Body for rejectManualPayment endpoint
 */
export interface RejectPaymentBody {
  purchaseId: string;
  rejectionReason: string;
}
