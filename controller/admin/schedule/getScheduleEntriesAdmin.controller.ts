import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { ScheduleEntryModel } from "@root/databaseManagers/mongoose/index.js";

// ═══════════════════════════════════════════════════════════════════
// GET ALL SCHEDULE ENTRIES (Admin)
// ═══════════════════════════════════════════════════════════════════

export const getScheduleEntriesAdmin = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { day, venue, category } = req.query;

    const query: Record<string, unknown> = {};
    if (day) query.day = parseInt(day as string);
    if (venue) query.venueSlug = (venue as string).toLowerCase();
    if (category) query.categorySlug = (category as string).toUpperCase();

    const entries = await ScheduleEntryModel.find(query)
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
