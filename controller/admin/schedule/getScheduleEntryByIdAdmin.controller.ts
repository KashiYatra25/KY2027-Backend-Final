import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound } from "zodex-axon/errors";
import { ScheduleEntryModel } from "@root/databaseManagers/mongoose/index.js";

// ═══════════════════════════════════════════════════════════════════
// GET SINGLE SCHEDULE ENTRY (Admin)
// ═══════════════════════════════════════════════════════════════════

export const getScheduleEntryByIdAdmin = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { scheduleEntryId } = req.params;

    const entry = await ScheduleEntryModel.findById(scheduleEntryId).populate("venueId").lean();

    if (!entry) {
      return next(new NotFound().handleResponse(res, { info: "Schedule entry not found" }));
    }

    new OkResponseStrategy().handleResponse(res, {
      info: "Schedule entry fetched successfully",
      entry,
    });
  },
);
