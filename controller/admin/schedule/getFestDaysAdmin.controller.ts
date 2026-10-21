import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { FestDayModel } from "@root/databaseManagers/mongoose/index.js";

// ═══════════════════════════════════════════════════════════════════
// GET ALL FEST DAYS (Admin)
// ═══════════════════════════════════════════════════════════════════

export const getFestDaysAdmin = catchAsync(
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    const festDays = await FestDayModel.find().sort({ dayNumber: 1 }).lean();

    new OkResponseStrategy().handleResponse(res, {
      info: "Fest days fetched successfully",
      festDays,
      count: festDays.length,
    });
  },
);
