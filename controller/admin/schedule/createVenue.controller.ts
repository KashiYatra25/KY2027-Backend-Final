import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { CreateResponseStrategy } from "zodex-axon/responses";
import { BadRequest } from "zodex-axon/errors";
import { VenueModel } from "@root/databaseManagers/mongoose/index.js";
import { logger } from "@logger/logger.js";
import { bumpScheduleCacheVersion } from "@redis/scheduleCache.service.js";
import type { CreateVenueRequestSchemaType } from "@schemas/admin/schedule.schema.js";

// ═══════════════════════════════════════════════════════════════════
// CREATE VENUE
// ═══════════════════════════════════════════════════════════════════

export const createVenue = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const data = req.body as CreateVenueRequestSchemaType;

    // Check for duplicate slug
    const existing = await VenueModel.findOne({ slug: data.slug });
    if (existing) {
      return next(new BadRequest().handleResponse(res, {
        info: "Venue with this slug already exists",
      }));
    }

    const venue = await VenueModel.create(data);

    // Invalidate all schedule caches (version bump).
    await bumpScheduleCacheVersion();

    logger.info("Venue created", { venueId: venue._id, slug: venue.slug });

    new CreateResponseStrategy().handleResponse(res, {
      info: "Venue created successfully",
      venue,
    });
  },
);
