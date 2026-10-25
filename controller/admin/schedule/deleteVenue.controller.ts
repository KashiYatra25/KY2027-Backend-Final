import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound } from "zodex-axon/errors";
import { VenueModel } from "@root/databaseManagers/mongoose/index.js";
import { logger } from "@logger/logger.js";
import { bumpScheduleCacheVersion } from "@redis/scheduleCache.service.js";
import type { VenueIdParamRequestSchemaType } from "@schemas/admin/schedule.schema.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// DELETE VENUE (Soft Delete - sets active to false)
// ═══════════════════════════════════════════════════════════════════

export const deleteVenue = catchAsync(
  async (
    req: VerifiedRequest<{ params: VenueIdParamRequestSchemaType }, AdminRequestWithVerifiedCreds>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { venueId } = req.validatedParams;

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
