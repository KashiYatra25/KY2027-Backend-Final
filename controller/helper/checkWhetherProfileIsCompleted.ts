import { AccountProgressModel } from "@root/databaseManagers/mongoose";
import type {
  ProfileCompletionResult,
  ProfileCompletionStep,
  UserLookupParams,
} from "./types/helper.types";

/**
 * Check if a user's profile is complete (MongoDB AccountProgress)
 */
export const checkForProfileCompletion = async (
  params: UserLookupParams,
): Promise<ProfileCompletionResult> => {
  const progress = await AccountProgressModel.findOne(
    { userId: params.userId },
    { profileCompletionAndVerification: 1, userId: 1 },
  );

  if (!progress) {
    return {
      isComplete: false,
      missingSteps: ["accountProgress"],
    };
  }

  const missingSteps: ProfileCompletionStep[] = [];
  const verification = progress.profileCompletionAndVerification;

  if (!verification?.hasVerifiedPhoneNumber) {
    missingSteps.push("phoneVerification");
  }
  if (!verification?.hasSelectedCollegeDetails) {
    missingSteps.push("collegeDetails");
  }
  if (!verification?.hasAadhaarBeenUploaded) {
    missingSteps.push("aadhaarUpload");
  }
  if (!verification?.hasAadhaarBeenVerified) {
    missingSteps.push("aadhaarVerification");
  }

  return {
    isComplete: missingSteps.length === 0,
    missingSteps,
    userId: progress.userId,
  };
};
