/**
 * KyId Generator Service
 *
 * Generates unique Kashiyatra IDs for users on profile completion.
 * Format: KY-2027-{8 random base62 chars}
 * Example: KY-2027-8xK2mNpQ
 *
 * With 62^8 = 218 trillion combinations, collision is virtually impossible
 * for 15k users, but we still check uniqueness just in case.
 */

import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";

const KY_ID_PREFIX = "KY-2027-";
const KY_ID_LENGTH = 8; // Random part length
const MAX_RETRIES = 5;

const BASE62_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Generate a random base62 string of given length
 */
function generateRandomBase62(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * BASE62_ALPHABET.length);
    result += BASE62_ALPHABET[randomIndex];
  }
  return result;
}

/**
 * Generate a unique Kashiyatra ID
 * Format: KY-2027-{8 random chars}
 *
 * Checks database for uniqueness and retries if collision occurs.
 *
 * @returns Promise<string> - Unique kyId
 * @throws Error if unable to generate unique ID after max retries
 */
export async function generateUniqueKyId(): Promise<string> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const randomPart = generateRandomBase62(KY_ID_LENGTH);
    const kyId = `${KY_ID_PREFIX}${randomPart}`;

    // Check if this kyId already exists
    const existing = await prisma.user.findUnique({
      where: { kyId },
      select: { id: true },
    });

    if (!existing) {
      logger.debug("Generated unique kyId", { kyId, attempt });
      return kyId;
    }

    logger.warn("kyId collision detected, retrying", { kyId, attempt });
  }

  // This should never happen with 62^8 combinations
  logger.error("Failed to generate unique kyId after max retries", {
    maxRetries: MAX_RETRIES,
  });
  throw new Error("Failed to generate unique kyId after max retries");
}
