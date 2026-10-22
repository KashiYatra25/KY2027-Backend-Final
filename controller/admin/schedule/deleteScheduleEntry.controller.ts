import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound } from "zodex-axon/errors";
import { ScheduleEntryModel } from "@root/databaseManagers/mongoose/index.js";
import { logger } from "@logger/logger.js";
import { bumpScheduleCacheVersion } from "@redis/scheduleCache.service.js";

// ═══════════════════════════════════════════════════════════════════
// DELETE SCHEDULE ENTRY (Soft Delete - sets active to false)
// ═══════════════════════════════════════════════════════════════════

export const deleteScheduleEntry = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { scheduleEntryId } = req.params;

    const entry = await ScheduleEntryModel.findByIdAndUpdate(
      scheduleEntryId,
      { active: false },
      { new: true }
    );
    // Invalidate all schedule caches (version bump).
    await bumpScheduleCacheVersion();


    if (!entry) {
      return next(new NotFound().handleResponse(res, { info: "Schedule entry not found" }));
    }

    logger.info("Schedule entry deactivated", { entryId: entry._id, eventSlug: entry.eventSlug });

    new OkResponseStrategy().handleResponse(res, {
      info: "Schedule entry deactivated successfully",
      entry,
    });
  },
);
