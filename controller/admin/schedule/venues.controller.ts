import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy, CreateResponseStrategy } from "zodex-axon/responses";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { VenueModel } from "@root/databaseManagers/mongoose/index.js";
import { logger } from "@logger/logger.js";
import type {
  CreateVenueSchemaType,
  UpdateVenueSchemaType,
} from "@schemas/admin/schedule.schema.js";

// ═══════════════════════════════════════════════════════════════════
// GET ALL VENUES (Admin)
// ═══════════════════════════════════════════════════════════════════

export const getVenuesAdmin = catchAsync(
  async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const venues = await VenueModel.find().sort({ sortOrder: 1, createdAt: -1 }).lean();

    new OkResponseStrategy().handleResponse(res, {
      info: "Venues fetched successfully",
      venues,
      count: venues.length,
    });
  },
);

// ═══════════════════════════════════════════════════════════════════
// GET SINGLE VENUE (Admin)
// ═══════════════════════════════════════════════════════════════════

export const getVenueByIdAdmin = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { venueId } = req.params;

    const venue = await VenueModel.findById(venueId).lean();

    if (!venue) {
      new NotFound().handleResponse(res, { info: "Venue not found" });
      return;
    }

    new OkResponseStrategy().handleResponse(res, {
      info: "Venue fetched successfully",
      venue,
    });
  },
);

// ═══════════════════════════════════════════════════════════════════
// CREATE VENUE
// ═══════════════════════════════════════════════════════════════════

export const createVenue = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const data = req.body as CreateVenueSchemaType;

    // Check for duplicate slug
    const existing = await VenueModel.findOne({ slug: data.slug });
    if (existing) {
      new BadRequest().handleResponse(res, {
        info: "Venue with this slug already exists",
      });
      return;
    }

    const venue = await VenueModel.create(data);

    logger.info("Venue created", { venueId: venue._id, slug: venue.slug });

    new CreateResponseStrategy().handleResponse(res, {
      info: "Venue created successfully",
      venue,
    });
  },
);

// ═══════════════════════════════════════════════════════════════════
// UPDATE VENUE
// ═══════════════════════════════════════════════════════════════════

export const updateVenue = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { venueId } = req.params;
    const data = req.body as UpdateVenueSchemaType;

    const venue = await VenueModel.findByIdAndUpdate(
      venueId,
      { $set: data },
      { new: true, runValidators: true },
    );

    if (!venue) {
      new NotFound().handleResponse(res, { info: "Venue not found" });
      return;
    }

    logger.info("Venue updated", { venueId: venue._id, slug: venue.slug });

    new OkResponseStrategy().handleResponse(res, {
      info: "Venue updated successfully",
      venue,
    });
  },
);

// ═══════════════════════════════════════════════════════════════════
// DELETE VENUE (Soft Delete - sets active to false)
// ═══════════════════════════════════════════════════════════════════

export const deleteVenue = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { venueId } = req.params;

    const venue = await VenueModel.findByIdAndUpdate(
      venueId,
      { active: false },
      { new: true }
    );

    if (!venue) {
      new NotFound().handleResponse(res, { info: "Venue not found" });
      return;
    }

    logger.info("Venue deactivated", { venueId: venue._id, slug: venue.slug });

    new OkResponseStrategy().handleResponse(res, {
      info: "Venue deactivated successfully",
      venue,
    });
  },
);

// ═══════════════════════════════════════════════════════════════════
// BULK CREATE VENUES
// ═══════════════════════════════════════════════════════════════════

export const bulkCreateVenues = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { venues } = req.body as { venues: CreateVenueSchemaType[] };

    // Check for duplicate slugs in request
    const slugs = venues.map((v) => v.slug);
    const uniqueSlugs = new Set(slugs);
    if (uniqueSlugs.size !== slugs.length) {
      new BadRequest().handleResponse(res, {
        info: "Duplicate slugs in request",
      });
      return;
    }

    // Check for existing slugs
    const existingSlugs = await VenueModel.find({ slug: { $in: slugs } }).select("slug").lean();
    if (existingSlugs.length > 0) {
      new BadRequest().handleResponse(res, {
        info: `Venues with these slugs already exist: ${existingSlugs.map((v) => v.slug).join(", ")}`,
      });
      return;
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
