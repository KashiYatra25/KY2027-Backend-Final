import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { CreateResponseStrategy } from "zodex-axon/responses";
import { BadRequest } from "zodex-axon/errors";
import { ScheduleEntryModel, VenueModel } from "@root/databaseManagers/mongoose/index.js";
import { logger } from "@logger/logger.js";
import { bumpScheduleCacheVersion } from "@redis/scheduleCache.service.js";
import type { CreateScheduleEntryRequestSchemaType } from "@schemas/admin/schedule.schema.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// CREATE SCHEDULE ENTRY
// ═══════════════════════════════════════════════════════════════════

export const createScheduleEntry = catchAsync(
  async (
    req: VerifiedRequest<{ body: CreateScheduleEntryRequestSchemaType }, AdminRequestWithVerifiedCreds>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const data = req.validatedData;

    // Verify venue exists
    const venue = await VenueModel.findOne({ slug: data.venueSlug });
    if (!venue) {
      return next(new BadRequest().handleResponse(res, {
        info: "Venue not found",
      }));
    }

    // Check for duplicate entry
    const existing = await ScheduleEntryModel.findOne({
      eventSlug: data.eventSlug,
      day: data.day,
    });
    if (existing) {
      return next(new BadRequest().handleResponse(res, {
        info: "Schedule entry for this event on this day already exists",
      }));
    }

    const entry = await ScheduleEntryModel.create({
      ...data,
      venueId: venue._id,
    });

    // Invalidate all schedule caches (version bump).
    await bumpScheduleCacheVersion();

    logger.info("Schedule entry created", {
      entryId: entry._id,
      eventSlug: entry.eventSlug,
      day: entry.day,
    });

    new CreateResponseStrategy().handleResponse(res, {
      info: "Schedule entry created successfully",
      entry,
    });
  },
);
