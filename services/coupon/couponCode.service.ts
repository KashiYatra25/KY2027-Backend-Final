/**
 * Coupon Code Generator Service
 *
 * Generates unique coupon codes for the admin dashboard.
 * Format: KY-2027-CPN-{6 random base62 chars}
 * Example: KY-2027-CPN-8xK2mN
 *
 * With 62^6 = 56 billion combinations, collision is virtually impossible
 * for coupon codes, but we still check uniqueness just in case.
 */

import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";

const COUPON_PREFIX = "KY-2027-CPN-";
const COUPON_CODE_LENGTH = 6; // Random part length
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
 * Generate a unique Coupon Code
 * Format: KY-2027-CPN-{6 random chars}
 *
 * Checks database for uniqueness and retries if collision occurs.
 *
 * @returns Promise<string> - Unique coupon code
 * @throws Error if unable to generate unique code after max retries
 */
export async function generateUniqueCouponCode(): Promise<string> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const randomPart = generateRandomBase62(COUPON_CODE_LENGTH);
    const couponCode = `${COUPON_PREFIX}${randomPart}`;

    // Check if this coupon code already exists
    const existing = await prisma.coupon.findUnique({
      where: { code: couponCode },
      select: { id: true },
    });

    if (!existing) {
      logger.debug("Generated unique coupon code", { couponCode, attempt });
      return couponCode;
    }

    logger.warn("Coupon code collision detected, retrying", { couponCode, attempt });
  }

  // This should never happen with 62^6 combinations
  logger.error("Failed to generate unique coupon code after max retries", {
    maxRetries: MAX_RETRIES,
  });
  throw new Error("Failed to generate unique coupon code after max retries");
}
