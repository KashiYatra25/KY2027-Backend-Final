import type { Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest } from "zodex-axon/errors";
import { logger } from "@logger/logger.js";
import { prisma } from "@root/prisma.js";
import { redisService } from "@redis/index.js";
import { getMyAccountCacheKey } from "@redis/keys/redis.keys.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// TOGGLE USER PAID STATUS
//
// MASTER_ADMIN-only endpoint to toggle a user's isPaidUser status.
// Useful for:
// - Offline payments that need manual reconciliation
// - Special cases where webhook didn't fire
// - VIP/sponsor accounts
// - Revoking paid status if needed
//
// Body: { userId: string }
// Toggles: isPaidUser true <-> false
// Also invalidates user's myAccount cache so they see the update.
// ═══════════════════════════════════════════════════════════════════

export const toggleUserPaidStatus = catchAsync(
  async (req: AdminRequestWithVerifiedCreds, res: Response) => {
    const { userId } = req.body as { userId?: string };

    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      new BadRequest().handleResponse(res, {
        info: "userId is required",
      });
      return;
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isPaidUser: true },
    });

    if (!user) {
      new BadRequest().handleResponse(res, {
        info: "User not found",
      });
      return;
    }

    // Toggle isPaidUser status
    const newStatus = !user.isPaidUser;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isPaidUser: newStatus },
      select: { id: true, email: true, isPaidUser: true },
    });

    // Invalidate user's myAccount cache so they see the update immediately
    try {
      const client = redisService.redisConnection;
      if (client) {
        const cacheKey = getMyAccountCacheKey(userId);
        await client.del(cacheKey);
        logger.info("User myAccount cache invalidated", { userId, cacheKey });
      }
    } catch (err) {
      logger.error("Failed to invalidate user cache", {
        userId,
        error: (err as Error).message,
      });
      // Don't fail the request if cache invalidation fails
    }

    logger.info("Admin: User paid status toggled", {
      userId: updatedUser.id,
      email: updatedUser.email,
      previousStatus: user.isPaidUser,
      newStatus: updatedUser.isPaidUser,
    });

    new OkResponseStrategy().handleResponse(res, {
      info: `User ${newStatus ? "marked as paid" : "marked as unpaid"} successfully`,
      user: updatedUser,
    });
  }
);
