import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound } from "zodex-axon/errors";
import { FestDayModel } from "@root/databaseManagers/mongoose/index.js";

// ═══════════════════════════════════════════════════════════════════
// GET SINGLE FEST DAY (Admin)
// ═══════════════════════════════════════════════════════════════════

export const getFestDayByIdAdmin = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { festDayId } = req.params;

    const festDay = await FestDayModel.findById(festDayId).lean();

    if (!festDay) {
      return next(new NotFound().handleResponse(res, { info: "Fest day not found" }));
    }

    new OkResponseStrategy().handleResponse(res, {
      info: "Fest day fetched successfully",
      festDay,
    });
  },
);
