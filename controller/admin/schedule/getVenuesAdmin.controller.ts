import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { VenueModel } from "@root/databaseManagers/mongoose/index.js";

// ═══════════════════════════════════════════════════════════════════
// GET ALL VENUES (Admin)
// ═══════════════════════════════════════════════════════════════════

export const getVenuesAdmin = catchAsync(
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    const venues = await VenueModel.find().sort({ sortOrder: 1, createdAt: -1 }).lean();

    new OkResponseStrategy().handleResponse(res, {
      info: "Venues fetched successfully",
      venues,
      count: venues.length,
    });
  },
);
