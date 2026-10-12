import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { VenueModel } from "@root/databaseManagers/mongoose/index.js";

// ═══════════════════════════════════════════════════════════════════
// GET VENUES CONTROLLER
// Public endpoint - returns all active venues for the campus map
// ═══════════════════════════════════════════════════════════════════

export const getVenues = catchAsync(
  async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const venues = await VenueModel.find({ active: true })
      .sort({ sortOrder: 1 })
      .select("-__v -createdAt -updatedAt")
      .lean();

    // Transform to match frontend expected format
    const formattedVenues = venues.map((venue) => ({
      slug: venue.slug,
      name: venue.name,
      label: venue.label,
      tone: venue.tone,
      large: venue.large || undefined,
      x: venue.x,
      y: venue.y,
      anchor: venue.anchorX && venue.anchorY ? [venue.anchorX, venue.anchorY] : undefined,
      clickable: venue.clickable,
    }));

    new OkResponseStrategy().handleResponse(res, {
      info: "Venues fetched successfully",
      venues: formattedVenues,
      count: formattedVenues.length,
    });
  },
);
