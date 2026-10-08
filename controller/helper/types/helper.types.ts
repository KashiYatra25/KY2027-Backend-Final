// ============================================
// User Lookup Types
// ============================================

// At least one of userId or email must be provided
export type UserLookupParams = 
  | { userId: string; email?: string }
  | { userId?: string; email: string };

// ============================================
// User Exists Check Types
// ============================================

export type UserExistsResult =
  | {
      exists: false;
      user: null;
    }
  | {
      exists: true;
      user: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
      };
    };

// ============================================
// Profile Completion Types
// ============================================

export type ProfileCompletionResult = {
  isComplete: boolean;
  missingSteps: ProfileCompletionStep[];
  userId ?: string
};

export type ProfileCompletionStep =
  | "accountProgress"
  | "phoneVerification"
  | "collegeDetails"
  | "aadhaarUpload"
  | "aadhaarVerification";

// ============================================
// Suspension Check Types
// ============================================

export type SuspensionCheckResult = {
  isSuspended: boolean;
};
