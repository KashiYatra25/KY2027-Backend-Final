import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound } from "zodex-axon/errors";
import { VenueModel } from "@root/databaseManagers/mongoose/index.js";
import { logger } from "@logger/logger.js";
import type { UpdateVenueRequestSchemaType } from "@schemas/admin/schedule.schema.js";

// ═══════════════════════════════════════════════════════════════════
// UPDATE VENUE
// ═══════════════════════════════════════════════════════════════════

export const updateVenue = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { venueId } = req.params;
    const data = req.body as UpdateVenueRequestSchemaType;

    const venue = await VenueModel.findByIdAndUpdate(
      venueId,
      { $set: data },
      { new: true, runValidators: true },
    );

    if (!venue) {
      return next(new NotFound().handleResponse(res, { info: "Venue not found" }));
    }

    logger.info("Venue updated", { venueId: venue._id, slug: venue.slug });

    new OkResponseStrategy().handleResponse(res, {
      info: "Venue updated successfully",
      venue,
    });
  },
);
