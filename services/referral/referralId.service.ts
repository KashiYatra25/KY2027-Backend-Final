/**
 * ReferralIdService - Distributed ID generation for CA referral codes
 *
 * Uses Redis range allocation strategy:
 * - Each server instance gets a pre-allocated range of IDs on startup
 * - IDs are generated locally from the allocated range (fast, no Redis call)
 * - When range is exhausted, a new range is fetched from Redis
 *
 * This ensures:
 * - No duplicate IDs across multiple server instances
 * - High performance (local counter increments)
 * - Unique, short referral codes using base62 encoding
 */

import { redisService } from "@redis/index.js";
import { CA_REFERRAL_RANGE_CURSOR_KEY } from "@redis/keys/redis.keys.js";
import { encodeBase62Padded } from "./utils/base62.js";
import { logger } from "@logger/logger.js";

const REFERRAL_PREFIX = "KY27";
const RANGE_SIZE = 10_000; // Each server gets 10,000 IDs at a time
const MIN_ID_LENGTH = 4; // Minimum base62 length (pad with zeros)
const INITIAL_CURSOR = 10_000; // Start from 10000 for nicer looking IDs

class ReferralIdService {
  private rangeStart: number = 0;
  private rangeEnd: number = 0;
  private currentCounter: number = 0;
  private initialized: boolean = false;

  /**
   * Initialize the service by allocating a range from Redis
   * Should be called on server startup
   */
  async initialize(): Promise<void> {
    try {
      const redis = redisService.redisConnection;
      if (!redis) {
        throw new Error("Redis connection not available");
      }

      // Initialize cursor if it doesn't exist
      const currentCursor = await redis.get(CA_REFERRAL_RANGE_CURSOR_KEY);
      if (currentCursor === null) {
        await redis.set(CA_REFERRAL_RANGE_CURSOR_KEY, INITIAL_CURSOR);
        logger.info("Initialized CA referral cursor", {
          initialValue: INITIAL_CURSOR,
        });
      }

      // Atomically increment and get new range
      const newCursor = await redis.incrby(
        CA_REFERRAL_RANGE_CURSOR_KEY,
        RANGE_SIZE,
      );

      this.rangeEnd = newCursor - 1;
      this.rangeStart = newCursor - RANGE_SIZE;
      this.currentCounter = this.rangeStart;
      this.initialized = true;

      logger.info("ReferralIdService initialized", {
        rangeStart: this.rangeStart,
        rangeEnd: this.rangeEnd,
        rangeSize: RANGE_SIZE,
      });
    } catch (error) {
      logger.error("Failed to initialize ReferralIdService", { error });
      throw error;
    }
  }

  /**
   * Get the next unique referral ID
   * Format: KY27-XXXX (where XXXX is base62 encoded)
   *
   * @returns Promise<string> - Unique referral ID
   * @throws Error if service not initialized or range exhausted and cannot refresh
   */
  async getNextId(): Promise<string> {
    if (!this.initialized) {
      throw new Error(
        "ReferralIdService not initialized. Call initialize() first.",
      );
    }

    // Check if we need a new range
    if (this.currentCounter > this.rangeEnd) {
      logger.info("Range exhausted, fetching new range", {
        exhaustedRange: `${this.rangeStart}-${this.rangeEnd}`,
      });
      await this.initialize();
    }

    const id = this.currentCounter++;
    const encoded = encodeBase62Padded(id, MIN_ID_LENGTH);
    const referralId = `${REFERRAL_PREFIX}-${encoded}`;

    logger.debug("Generated referral ID", {
      numericId: id,
      referralId,
      remainingInRange: this.rangeEnd - this.currentCounter + 1,
    });

    return referralId;
  }

  /**
   * Get current range info (for monitoring/debugging)
   */
  getRangeInfo(): {
    rangeStart: number;
    rangeEnd: number;
    currentCounter: number;
    remaining: number;
    initialized: boolean;
  } {
    return {
      rangeStart: this.rangeStart,
      rangeEnd: this.rangeEnd,
      currentCounter: this.currentCounter,
      remaining: Math.max(0, this.rangeEnd - this.currentCounter + 1),
      initialized: this.initialized,
    };
  }
}

// Singleton instance
export const referralIdService = new ReferralIdService();
