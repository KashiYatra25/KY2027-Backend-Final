/**
 * KyId Generator Service
 *
 * Generates unique random Kashiyatra IDs for users on profile completion.
 * Format: KY-2027-{5 random digits}
 * Example: KY-2027-48291, KY-2027-73056, KY-2027-12847
 *
 * Uses Redis SET to track used IDs and ensure uniqueness.
 * Range: 10000 to 99999 (5-digit numbers, no leading zeros)
 */

import { redisService } from "@redis/index.js";
import { logger } from "@logger/logger.js";

const KY_ID_PREFIX = "KY-2027-";
const KY_ID_SET_KEY = "ky:ids:used"; // Redis SET of used IDs
const MIN_ID = 10000; // Start at 10000 (always 5 digits)
const MAX_ID = 99999;
const MAX_ATTEMPTS = 100; // Max collision retries

class KyIdService {
  private initialized: boolean = false;

  /**
   * Initialize the service - just marks as ready
   * Should be called on server startup
   */
  async initialize(): Promise<void> {
    try {
      const redis = redisService.redisConnection;
      if (!redis) {
        throw new Error("Redis connection not available");
      }

      // Get current count for logging
      const usedCount = await redis.scard(KY_ID_SET_KEY);
      this.initialized = true;

      const totalPossible = MAX_ID - MIN_ID + 1;
      logger.info("KyIdService initialized", {
        usedIds: usedCount,
        totalPossible,
        remaining: totalPossible - usedCount,
      });
    } catch (error) {
      logger.error("Failed to initialize KyIdService", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Generate a random number between MIN_ID and MAX_ID
   */
  private generateRandomId(): number {
    return Math.floor(Math.random() * (MAX_ID - MIN_ID + 1)) + MIN_ID;
  }

  /**
   * Get a unique random KY ID
   * Format: KY-2027-XXXXX (5-digit random number)
   *
   * Uses SADD to atomically check and add - returns 1 if new, 0 if exists
   *
   * @returns Promise<string> - Unique KY ID
   * @throws Error if service not initialized or too many collisions
   */
  async getNextId(): Promise<string> {
    if (!this.initialized) {
      throw new Error("KyIdService not initialized. Call initialize() first.");
    }

    const redis = redisService.redisConnection;
    if (!redis) {
      throw new Error("Redis connection not available");
    }

    // Try to find an unused random ID
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const randomId = this.generateRandomId();

      // SADD returns 1 if the element was added (new), 0 if it already existed
      const added = await redis.sadd(KY_ID_SET_KEY, randomId);

      if (added === 1) {
        // Successfully claimed this ID
        const kyId = `${KY_ID_PREFIX}${randomId}`;

        logger.debug("Generated KY ID", {
          numericId: randomId,
          kyId,
          attempts: attempt + 1,
        });

        return kyId;
      }

      // Collision - try again
      logger.debug("KY ID collision, retrying", {
        attemptedId: randomId,
        attempt: attempt + 1,
      });
    }

    // Too many collisions - ID space might be nearly full
    const usedCount = await redis.scard(KY_ID_SET_KEY);
    const totalPossible = MAX_ID - MIN_ID + 1;

    logger.error("KY ID generation failed - too many collisions", {
      maxAttempts: MAX_ATTEMPTS,
      usedIds: usedCount,
      totalPossible,
      fillPercentage: ((usedCount / totalPossible) * 100).toFixed(2),
    });

    throw new Error(
      `Failed to generate unique KY ID after ${MAX_ATTEMPTS} attempts. ID space may be nearly full.`
    );
  }

  /**
   * Get current usage info (for monitoring/debugging)
   */
  async getInfo(): Promise<{
    usedIds: number;
    totalPossible: number;
    remaining: number;
    fillPercentage: string;
    initialized: boolean;
  }> {
    const redis = redisService.redisConnection;
    const usedCount = redis ? await redis.scard(KY_ID_SET_KEY) : 0;
    const totalPossible = MAX_ID - MIN_ID + 1;

    return {
      usedIds: usedCount,
      totalPossible,
      remaining: totalPossible - usedCount,
      fillPercentage: ((usedCount / totalPossible) * 100).toFixed(2) + "%",
      initialized: this.initialized,
    };
  }
}

// Singleton instance
export const kyIdService = new KyIdService();

/**
 * Generate a unique KY ID (convenience function)
 * Note: Requires kyIdService.initialize() to be called on server startup
 */
export async function generateUniqueKyId(): Promise<string> {
  return kyIdService.getNextId();
}
