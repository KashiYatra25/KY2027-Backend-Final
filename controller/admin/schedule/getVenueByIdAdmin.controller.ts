import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound } from "zodex-axon/errors";
import { VenueModel } from "@root/databaseManagers/mongoose/index.js";
import type { VenueIdParamRequestSchemaType } from "@schemas/admin/schedule.schema.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// GET VENUE BY ID (Admin)
// ═══════════════════════════════════════════════════════════════════

export const getVenueByIdAdmin = catchAsync(
  async (
    req: VerifiedRequest<{ params: VenueIdParamRequestSchemaType }, AdminRequestWithVerifiedCreds>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { venueId } = req.validatedParams;

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
