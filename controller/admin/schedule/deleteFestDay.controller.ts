import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound } from "zodex-axon/errors";
import { FestDayModel } from "@root/databaseManagers/mongoose/index.js";
import { logger } from "@logger/logger.js";
import { bumpScheduleCacheVersion } from "@redis/scheduleCache.service.js";

// ═══════════════════════════════════════════════════════════════════
// DELETE FEST DAY (Soft Delete - sets active to false)
// ═══════════════════════════════════════════════════════════════════

export const deleteFestDay = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { festDayId } = req.params;

    const festDay = await FestDayModel.findByIdAndUpdate(
      festDayId,
      { active: false },
      { new: true }
    );
    // Invalidate all schedule caches (version bump).
    await bumpScheduleCacheVersion();


    if (!festDay) {
      return next(new NotFound().handleResponse(res, { info: "Fest day not found" }));
    }

    logger.info("Fest day deactivated", { festDayId: festDay._id, dayNumber: festDay.dayNumber });

    new OkResponseStrategy().handleResponse(res, {
      info: "Fest day deactivated successfully",
      festDay,
    });
  },
);
