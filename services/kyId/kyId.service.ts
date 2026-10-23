/**
 * KyId Generator Service
 *
 * Generates unique Kashiyatra IDs for users on profile completion.
 * Format: KY-2027-{sequential number padded to 5 digits}
 * Example: KY-2027-00001, KY-2027-00042, KY-2027-12345
 *
 * Uses a simple Redis counter (single server deployment).
 * Range: 1 to 99999
 */

import { redisService } from "@redis/index.js";
import { KY_ID_RANGE_CURSOR_KEY } from "@redis/keys/redis.keys.js";
import { logger } from "@logger/logger.js";

const KY_ID_PREFIX = "KY-2027-";
const MIN_ID_LENGTH = 5; // 5 digits (00001 - 99999)
const MAX_ID = 99999;
const INITIAL_VALUE = 0; // Counter starts at 0, first ID will be 1

class KyIdService {
  private initialized: boolean = false;

  /**
   * Initialize the service - ensures Redis counter exists
   * Should be called on server startup
   */
  async initialize(): Promise<void> {
    try {
      const redis = redisService.redisConnection;
      if (!redis) {
        throw new Error("Redis connection not available");
      }

      // Initialize counter if it doesn't exist (SETNX)
      const exists = await redis.exists(KY_ID_RANGE_CURSOR_KEY);
      if (!exists) {
        await redis.set(KY_ID_RANGE_CURSOR_KEY, INITIAL_VALUE);
        logger.info("Initialized KY ID counter", { initialValue: INITIAL_VALUE });
      }

      // Get current value for logging
      const currentValue = await redis.get(KY_ID_RANGE_CURSOR_KEY);
      this.initialized = true;

      logger.info("KyIdService initialized", {
        currentCounter: Number(currentValue),
        maxId: MAX_ID,
        remaining: MAX_ID - Number(currentValue),
      });
    } catch (error) {
      logger.error("Failed to initialize KyIdService", { error });
      throw error;
    }
  }

  /**
   * Get the next unique KY ID
   * Format: KY-2027-XXXXX (5-digit zero-padded number)
   *
   * @returns Promise<string> - Unique KY ID
   * @throws Error if service not initialized or max ID reached
   */
  async getNextId(): Promise<string> {
    if (!this.initialized) {
      throw new Error("KyIdService not initialized. Call initialize() first.");
    }

    const redis = redisService.redisConnection;
    if (!redis) {
      throw new Error("Redis connection not available");
    }

    // Atomically increment and get new value
    const id = await redis.incr(KY_ID_RANGE_CURSOR_KEY);

    if (id > MAX_ID) {
      logger.error("KY ID limit reached!", { currentId: id, maxId: MAX_ID });
      throw new Error(`KY ID limit reached. Maximum is ${MAX_ID}`);
    }

    // Pad with leading zeros (5 digits)
    const padded = String(id).padStart(MIN_ID_LENGTH, "0");
    const kyId = `${KY_ID_PREFIX}${padded}`;

    logger.debug("Generated KY ID", {
      numericId: id,
      kyId,
      remaining: MAX_ID - id,
    });

    return kyId;
  }

  /**
   * Get current counter info (for monitoring/debugging)
   */
  async getInfo(): Promise<{
    currentCounter: number;
    maxId: number;
    remaining: number;
    initialized: boolean;
  }> {
    const redis = redisService.redisConnection;
    const currentValue = redis ? await redis.get(KY_ID_RANGE_CURSOR_KEY) : null;
    const counter = Number(currentValue) || 0;

    return {
      currentCounter: counter,
      maxId: MAX_ID,
      remaining: MAX_ID - counter,
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
