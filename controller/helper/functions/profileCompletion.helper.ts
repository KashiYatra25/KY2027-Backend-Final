import { AccountProgressModel } from "@root/databaseManagers/mongoose";
import { prisma } from "@root/prisma.js";
import type {
  ProfileCompletionStep,
  UserLookupParams,
  SingleProfileResult,
  MultipleProfileResult,
} from "../types/helper.types.js";

/**
 * Extract missing steps from profile verification data
 */
const getMissingSteps = (verification: {
  hasVerifiedPhoneNumber?: boolean;
  hasSelectedCollegeDetails?: boolean;
  hasAadhaarBeenUploaded?: boolean;
  hasAadhaarBeenVerified?: boolean;
} | null | undefined): ProfileCompletionStep[] => {
  const missingSteps: ProfileCompletionStep[] = [];

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

  return missingSteps;
};

/**
 * Resolve emails to userIds
 */
const resolveToUserIds = async (
  params: UserLookupParams | UserLookupParams[],
): Promise<{ userIds: string[]; notFound: string[] }> => {
  const paramsArray = Array.isArray(params) ? params : [params];
  
  const userIds: string[] = [];
  const emails: string[] = [];
  
  for (const p of paramsArray) {
    if (p.userId) {
      userIds.push(p.userId);
    } else if (p.email) {
      emails.push(p.email);
    }
  }

  // Resolve emails to userIds
  if (emails.length > 0) {
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true },
    });
    const emailToId = new Map(users.map((u) => [u.email, u.id]));
    
    const notFound: string[] = [];
    for (const email of emails) {
      const id = emailToId.get(email);
      if (id) {
        userIds.push(id);
      } else {
        notFound.push(email);
      }
    }
    
    return { userIds, notFound };
  }

  return { userIds, notFound: [] };
};

/**
 * Check if user(s) profile is complete (MongoDB AccountProgress)
 * 
 * Supports:
 * - Single user: { userId: "..." } or { email: "..." }
 * - Multiple users: [{ userId: "..." }, { email: "..." }, ...]
 * 
 * At least one of userId or email must be provided for each lookup
 * 
 * Returns:
 * - Single: { isComplete, missingSteps, userId }
 * - Multiple: { isComplete, incompleteUsers } - isComplete = true if ALL complete
 */
export async function checkForProfileCompletion(
  params: UserLookupParams,
): Promise<SingleProfileResult>;

export async function checkForProfileCompletion(
  params: UserLookupParams[],
): Promise<MultipleProfileResult>;

export async function checkForProfileCompletion(
  params: UserLookupParams | UserLookupParams[],
): Promise<SingleProfileResult | MultipleProfileResult> {
  const isArray = Array.isArray(params);
  
  // Resolve all lookups to userIds
  const { userIds, notFound } = await resolveToUserIds(params);

  // Single user case
  if (!isArray) {
    if (notFound.length > 0 || userIds.length === 0) {
      return {
        isComplete: false,
        missingSteps: ["accountProgress"],
      };
    }

    const progress = await AccountProgressModel.findOne(
      { userId: userIds[0] },
      { profileCompletionAndVerification: 1, userId: 1 },
    );

    if (!progress) {
      return {
        isComplete: false,
        missingSteps: ["accountProgress"],
      };
    }

    const missingSteps = getMissingSteps(progress.profileCompletionAndVerification);

    return {
      isComplete: missingSteps.length === 0,
      missingSteps,
      userId: progress.userId,
    };
  }

  // Array case - simplified response
  const incompleteUsers: string[] = [...notFound];

  if (userIds.length > 0) {
    const progresses = await AccountProgressModel.find(
      { userId: { $in: userIds } },
      { profileCompletionAndVerification: 1, userId: 1 },
    );

    const progressMap = new Map(progresses.map((p) => [p.userId, p]));

    for (const userId of userIds) {
      const progress = progressMap.get(userId);

      if (!progress) {
        incompleteUsers.push(userId);
        continue;
      }

      const missingSteps = getMissingSteps(progress.profileCompletionAndVerification);
      if (missingSteps.length > 0) {
        incompleteUsers.push(userId);
      }
    }
  }

  return {
    isComplete: incompleteUsers.length === 0,
    incompleteUsers,
  };
}


/**
 * Check if IIT BHU user just completed profile and auto-set isPaidUser
 * Call this after any profile step completion
 */
export const autoSetPaidForIITBhuUser = async (userId: string): Promise<boolean> => {
  // Check if user is from IIT BHU and profile is complete
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isFromIITBhu: true, isPaidUser: true },
  });

  if (!user || !user.isFromIITBhu || user.isPaidUser) {
    return false; // Not IIT BHU, or already paid
  }

  // Check if profile is complete
  const profileCheck = await checkForProfileCompletion({ userId });
  if (!profileCheck.isComplete) {
    return false; // Profile not complete yet
  }

  // Profile complete + IIT BHU user = auto-set isPaidUser
  await prisma.user.update({
    where: { id: userId },
    data: { isPaidUser: true },
  });

  return true;
};
