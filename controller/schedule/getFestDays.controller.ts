import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { FestDayModel } from "@root/databaseManagers/mongoose/index.js";

// ═══════════════════════════════════════════════════════════════════
// GET FEST DAYS CONTROLLER
// Public endpoint - returns all festival days
// ═══════════════════════════════════════════════════════════════════

export const getFestDays = catchAsync(
  async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const festDays = await FestDayModel.find({ active: true })
      .sort({ dayNumber: 1 })
      .select("-__v -createdAt -updatedAt -active")
      .lean();

    // Also create a map format for easy lookup: { 1: "14 Jan", 2: "15 Jan", ... }
    const festDaysMap: Record<number, string> = {};
    festDays.forEach((day) => {
      festDaysMap[day.dayNumber] = day.displayDate;
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Festival days fetched successfully",
      festDays,
      festDaysMap,
      count: festDays.length,
    });
  },
);
