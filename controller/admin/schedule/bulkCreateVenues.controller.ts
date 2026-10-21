import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { CreateResponseStrategy } from "zodex-axon/responses";
import { BadRequest } from "zodex-axon/errors";
import { VenueModel } from "@root/databaseManagers/mongoose/index.js";
import { logger } from "@logger/logger.js";
import type { CreateVenueRequestSchemaType } from "@schemas/admin/schedule.schema.js";

// ═══════════════════════════════════════════════════════════════════
// BULK CREATE VENUES
// ═══════════════════════════════════════════════════════════════════

export const bulkCreateVenues = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { venues } = req.body as { venues: CreateVenueRequestSchemaType[] };

    // Check for duplicate slugs in request
    const slugs = venues.map((v) => v.slug);
    const uniqueSlugs = new Set(slugs);
    if (uniqueSlugs.size !== slugs.length) {
      return next(new BadRequest().handleResponse(res, {
        info: "Duplicate slugs in request",
      }));
    }

    // Check for existing slugs
    const existingSlugs = await VenueModel.find({ slug: { $in: slugs } }).select("slug").lean();
    if (existingSlugs.length > 0) {
      return next(new BadRequest().handleResponse(res, {
        info: `Venues with these slugs already exist: ${existingSlugs.map((v) => v.slug).join(", ")}`,
      }));
    }

    const createdVenues = await VenueModel.insertMany(venues);

    logger.info("Bulk venues created", { count: createdVenues.length });

    new CreateResponseStrategy().handleResponse(res, {
      info: `${createdVenues.length} venues created successfully`,
      venues: createdVenues,
      count: createdVenues.length,
    });
  },
);
