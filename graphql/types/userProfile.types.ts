import type { Role, Gender } from '@lib/prisma/index.js';

// ═══════════════════════════════════════════════════════════════════
// USER PROFILE TYPES - For GraphQL Resolver
// ═══════════════════════════════════════════════════════════════════

/**
 * User profile data from PostgreSQL (Prisma) - serialized for GraphQL
 * Dates are converted to ISO strings
 */
export type UserProfileData = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  slugName: string;
  candidatePhotoUrl: string | null;
  googleAvatarUrl: string | null;
  phone: string | null;
  gender: Gender | null;
  college: string | null;
  dob: string | null;
  joinedAt: string;
  aadhaarNumber: string | null;
  isFromIITBhu: boolean;
  role: Pick<Role, 'id' | 'level'> | null;
};

/**
 * Verification steps for profile completion
 */
export type VerificationSteps = {
  aadhaarUploaded: boolean;
  aadhaarVerified: boolean;
  college: boolean;
  phone: boolean;
};

/**
 * Account progress data from MongoDB
 */
export type AccountProgressData = {
  steps: VerificationSteps;
  completedSteps: number;
  totalSteps: number;
  completionPercentage: number;
  isProfileComplete: boolean;
  accountStatus: 'ACTIVE' | 'SUSPENDED';
};

/**
 * Combined response type for myAccount query
 */
export type MyAccountResponse = {
  profile: UserProfileData;
  progress: AccountProgressData;
} | null;
