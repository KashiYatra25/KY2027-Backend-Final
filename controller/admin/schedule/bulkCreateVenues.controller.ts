import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { CreateResponseStrategy } from "zodex-axon/responses";
import { VenueModel } from "@root/databaseManagers/mongoose/index.js";
import { logger } from "@logger/logger.js";
import { bumpScheduleCacheVersion } from "@redis/scheduleCache.service.js";
import type { BulkCreateVenuesRequestSchemaType } from "@schemas/admin/schedule.schema.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// BULK CREATE VENUES
// ═══════════════════════════════════════════════════════════════════

export const bulkCreateVenues = catchAsync(
  async (
    req: VerifiedRequest<{ body: BulkCreateVenuesRequestSchemaType }, AdminRequestWithVerifiedCreds>,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { venues } = req.validatedData;

    const created = await VenueModel.insertMany(venues, { ordered: false });

    // Invalidate all schedule caches (version bump).
    await bumpScheduleCacheVersion();

    logger.info("Bulk venues created", { count: created.length });

    new CreateResponseStrategy().handleResponse(res, {
      info: `${created.length} venues created successfully`,
      venues: created,
    });
  },
);
