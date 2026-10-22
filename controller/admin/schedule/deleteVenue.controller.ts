import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound } from "zodex-axon/errors";
import { VenueModel } from "@root/databaseManagers/mongoose/index.js";
import { logger } from "@logger/logger.js";
import { bumpScheduleCacheVersion } from "@redis/scheduleCache.service.js";

// ═══════════════════════════════════════════════════════════════════
// DELETE VENUE (Soft Delete - sets active to false)
// ═══════════════════════════════════════════════════════════════════

export const deleteVenue = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { venueId } = req.params;

    const venue = await VenueModel.findByIdAndUpdate(
      venueId,
      { active: false },
      { new: true }
    );
    // Invalidate all schedule caches (version bump).
    await bumpScheduleCacheVersion();


    if (!venue) {
      return next(new NotFound().handleResponse(res, { info: "Venue not found" }));
    }

    logger.info("Venue deactivated", { venueId: venue._id, slug: venue.slug });

    new OkResponseStrategy().handleResponse(res, {
      info: "Venue deactivated successfully",
      venue,
    });
  },
);
