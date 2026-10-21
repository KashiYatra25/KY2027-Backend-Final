/**
 * Post-save hook: Auto-set isPaidUser for IIT BHU users
 *
 * When profile is completed and user is from IIT BHU,
 * automatically set isPaidUser = true (free pass for IIT BHU students)
 */

import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";
import type { AccountProgressDoc } from "@lib/mongo/user/accountProgress.model.js";

/**
 * Check if profile is complete based on verification flags
 */
const isProfileComplete = (doc: AccountProgressDoc): boolean => {
  const v = doc.profileCompletionAndVerification;
  return Boolean(
    v?.hasVerifiedPhoneNumber &&
    v?.hasSelectedCollegeDetails &&
    v?.hasIdentityBeenVerified
  );
};

/**
 * Post-save hook to auto-set isPaidUser for IIT BHU users
 */
export async function autoSetPaidForIITBhuUserHook(doc: AccountProgressDoc): Promise<void> {
  try {
    // Check if profile is complete from the saved document
    if (!isProfileComplete(doc)) {
      return;
    }

    const { userId } = doc;

    // Check if user is from IIT BHU and not already paid
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isFromIITBhu: true, isPaidUser: true },
    });

    if (!user) {
      logger.warn("User not found in autoSetPaidForIITBhuUser hook", { userId });
      return;
    }

    // Skip if not IIT BHU or already paid
    if (!user.isFromIITBhu || user.isPaidUser) {
      return;
    }

    // Auto-set isPaidUser for IIT BHU user
    await prisma.user.update({
      where: { id: userId },
      data: { isPaidUser: true },
    });

    logger.info("Auto-set isPaidUser for IIT BHU user on profile completion", { userId });
  } catch (error) {
    logger.error("Error in autoSetPaidForIITBhuUser hook", {
      userId: doc.userId,
      error,
    });
    // Don't throw - hook errors shouldn't break the main operation
  }
}
