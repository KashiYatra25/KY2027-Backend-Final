import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { CreateResponseStrategy } from "zodex-axon/responses";
import { BadRequest } from "zodex-axon/errors";
import { ScheduleEntryModel, VenueModel } from "@root/databaseManagers/mongoose/index.js";
import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";
import { bumpScheduleCacheVersion } from "@redis/scheduleCache.service.js";
import type { CreateScheduleEntryRequestSchemaType } from "@schemas/admin/schedule.schema.js";

// ═══════════════════════════════════════════════════════════════════
// CREATE SCHEDULE ENTRY
// ═══════════════════════════════════════════════════════════════════

export const createScheduleEntry = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const data = req.body as CreateScheduleEntryRequestSchemaType;

    // Check event exists in Prisma
    const event = await prisma.event.findUnique({
      where: { slug: data.eventSlug },
      select: { id: true, slug: true, category: true },
    });

    if (!event) {
      return next(new BadRequest().handleResponse(res, {
        info: `Event with slug '${data.eventSlug}' not found`,
      }));
    }

    // Check category matches
    if (event.category !== data.categorySlug) {
      return next(new BadRequest().handleResponse(res, {
        info: `Event category mismatch. Event is '${event.category}', provided '${data.categorySlug}'`,
      }));
    }

    // Check venue exists
    const venue = await VenueModel.findOne({ slug: data.venueSlug });
    if (!venue) {
      return next(new BadRequest().handleResponse(res, {
        info: `Venue with slug '${data.venueSlug}' not found`,
      }));
    }

    // Check for duplicate eventSlug (one schedule per event)
    const existing = await ScheduleEntryModel.findOne({ eventSlug: data.eventSlug });
    if (existing) {
      return next(new BadRequest().handleResponse(res, {
        info: `Event '${data.eventSlug}' is already scheduled`,
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
      venueSlug: entry.venueSlug,
      day: entry.day,
    });

    new CreateResponseStrategy().handleResponse(res, {
      info: "Schedule entry created successfully",
      entry,
    });
  },
);
