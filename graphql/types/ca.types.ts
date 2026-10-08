import type { CAApplicationStatus } from "@lib/prisma/index.js";

// ═══════════════════════════════════════════════════════════════════
// CA TYPES - For GraphQL Resolver
// ═══════════════════════════════════════════════════════════════════

/**
 * CA Application data
 */
export type CaApplicationData = {
  id: string;
  status: CAApplicationStatus;
  rejectionReason: string | null;
  appliedAt: string;
  updatedAt: string;
};

/**
 * CA Profile data (created when application is approved)
 */
export type CaProfileData = {
  id: string;
  referralId: string;
  numberOfReferrals: number;
  approvedAt: string;
};

/**
 * Response type for myCaInfo query
 */
export type MyCaInfoResponse = {
  hasApplied: boolean;
  application: CaApplicationData | null;
  profile: CaProfileData | null;
};
