import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound } from "zodex-axon/errors";
import { VenueModel } from "@root/databaseManagers/mongoose/index.js";

// ═══════════════════════════════════════════════════════════════════
// GET SINGLE VENUE (Admin)
// ═══════════════════════════════════════════════════════════════════

export const getVenueByIdAdmin = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { venueId } = req.params;

    const venue = await VenueModel.findById(venueId).lean();

    if (!venue) {
      return next(new NotFound().handleResponse(res, { info: "Venue not found" }));
    }

    new OkResponseStrategy().handleResponse(res, {
      info: "Venue fetched successfully",
      venue,
    });
  },
);
