import type { Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { FestDayModel } from "@root/databaseManagers/mongoose/index.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// GET ALL FEST DAYS (Admin)
// Returns all fest days including inactive ones for admin management
// ═══════════════════════════════════════════════════════════════════

export const getFestDaysAdmin = catchAsync(
  async (_req: AdminRequestWithVerifiedCreds, res: Response, _next: NextFunction): Promise<void> => {
    const festDays = await FestDayModel.find()
      .sort({ dayNumber: 1 })
      .lean();

    new OkResponseStrategy().handleResponse(res, {
      info: "Fest days fetched successfully",
      festDays,
      count: festDays.length,
    });
  },
);
