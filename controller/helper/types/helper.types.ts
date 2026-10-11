// ============================================
// User Lookup Types
// ============================================

// At least one of userId or email must be provided
export type UserLookupParams = 
  | { userId: string; email?: string }
  | { userId?: string; email: string };

// ============================================
// Profile Completion Types
// ============================================

export type ProfileCompletionStep =
  | "accountProgress"
  | "phoneVerification"
  | "collegeDetails"
  | "aadhaarUpload"
  | "aadhaarVerification";

// Single user profile check result
export interface SingleProfileResult {
  isComplete: boolean;
  missingSteps: ProfileCompletionStep[];
  userId?: string;
}

// Multiple users profile check result
export interface MultipleProfileResult {
  isComplete: boolean;
  incompleteUsers: string[];
}

// Legacy type alias for backward compatibility
export type ProfileCompletionResult = SingleProfileResult;
