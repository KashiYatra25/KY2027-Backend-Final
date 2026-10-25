import type { Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { VenueModel } from "@root/databaseManagers/mongoose/index.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// GET ALL VENUES (Admin)
// Returns all venues including inactive ones for admin management
// ═══════════════════════════════════════════════════════════════════

export const getVenuesAdmin = catchAsync(
  async (_req: AdminRequestWithVerifiedCreds, res: Response, _next: NextFunction): Promise<void> => {
    const venues = await VenueModel.find()
      .sort({ sortOrder: 1 })
      .lean();

    new OkResponseStrategy().handleResponse(res, {
      info: "Venues fetched successfully",
      venues,
      count: venues.length,
    });
  },
);
