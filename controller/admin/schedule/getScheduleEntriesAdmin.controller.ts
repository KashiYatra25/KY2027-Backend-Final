import type { Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { ScheduleEntryModel } from "@root/databaseManagers/mongoose/index.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// GET ALL SCHEDULE ENTRIES (Admin)
// Returns all schedule entries including inactive ones for admin management
// ═══════════════════════════════════════════════════════════════════

export const getScheduleEntriesAdmin = catchAsync(
  async (_req: AdminRequestWithVerifiedCreds, res: Response, _next: NextFunction): Promise<void> => {
    const entries = await ScheduleEntryModel.find()
      .populate("venueId")
      .sort({ day: 1, sortOrder: 1 })
      .lean();

    new OkResponseStrategy().handleResponse(res, {
      info: "Schedule entries fetched successfully",
      entries,
      count: entries.length,
    });
  },
);
