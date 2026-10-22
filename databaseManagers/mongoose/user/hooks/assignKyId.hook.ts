/**
 * Post-save hook: Assign unique kyId on profile completion
 *
 * When profile is completed, generate and assign a unique Kashiyatra ID
 * Format: ky-{8 random base62 chars}
 */

import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";
import { generateUniqueKyId } from "@root/services/kyId/index.js";
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
 * Post-save hook to assign kyId on profile completion
 */
export async function assignKyIdHook(doc: AccountProgressDoc): Promise<void> {
  try {
    // Check if profile is complete from the saved document
    if (!isProfileComplete(doc)) {
      return;
    }

    const { userId } = doc;

    // Check if user already has a kyId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { kyId: true },
    });

    if (!user) {
      logger.warn("User not found in assignKyId hook", { userId });
      return;
    }

    // Skip if kyId already assigned
    if (user.kyId) {
      return;
    }

    // Generate and assign unique kyId
    const kyId = await generateUniqueKyId();

    await prisma.user.update({
      where: { id: userId },
      data: { kyId },
    });

    logger.info("Assigned kyId on profile completion", { userId, kyId });

    // Invalidate the cached profile so the new kyId is reflected on next read.
    const { invalidateProfileCache } = await import(
      "@root/services/redis/entityCache.service.js"
    );
    await invalidateProfileCache(userId);
  } catch (error) {
    logger.error("Error in assignKyId hook", {
      userId: doc.userId,
      error,
    });
    // Don't throw - hook errors shouldn't break the main operation
  }
}
