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

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { kyId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        college: true,
        isFromIITBhu: true,
      },
    });

    logger.info("Assigned kyId on profile completion", { userId, kyId });

    // Invalidate the cached profile so the new kyId is reflected on next read.
    const { invalidateProfileCache } = await import(
      "@root/services/redis/entityCache.service.js"
    );
    await invalidateProfileCache(userId);

    // Export the completed profile to Google Sheets asynchronously.
    // Isolated try/catch: a queue/Redis failure must never affect profile completion.
    try {
      const { queueUserProfileExport } = await import("@root/services/queue/index.js");
      await queueUserProfileExport({
        kyId,
        name: `${updatedUser.firstName ?? ""} ${updatedUser.lastName ?? ""}`.trim(),
        email: updatedUser.email,
        phone: updatedUser.phone ?? "",
        college: updatedUser.college ?? "",
        isIITBHU: updatedUser.isFromIITBhu,
        profileCompletedAt: new Date().toISOString(),
      });
    } catch (exportError) {
      logger.error("Failed to queue Google Sheets export - user will not be exported until backfilled", {
        userId,
        kyId,
        error: exportError instanceof Error ? exportError.message : String(exportError),
      });
    }
  } catch (error) {
    logger.error("Error in assignKyId hook", {
      userId: doc.userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Don't throw - hook errors shouldn't break the main operation
  }
}
