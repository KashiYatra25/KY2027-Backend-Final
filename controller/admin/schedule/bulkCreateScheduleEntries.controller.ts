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
// BULK CREATE SCHEDULE ENTRIES
// ═══════════════════════════════════════════════════════════════════

export const bulkCreateScheduleEntries = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { entries } = req.body as { entries: CreateScheduleEntryRequestSchemaType[] };

    // Check for duplicate eventSlugs in request
    const eventSlugs = entries.map((e) => e.eventSlug);
    const uniqueEventSlugs = new Set(eventSlugs);
    if (uniqueEventSlugs.size !== eventSlugs.length) {
      return next(new BadRequest().handleResponse(res, {
        info: "Duplicate event slugs in request",
      }));
    }

    // Check all events exist
    const events = await prisma.event.findMany({
      where: { slug: { in: eventSlugs } },
      select: { slug: true, category: true },
    });

    const eventMap = new Map(events.map((e) => [e.slug, e]));
    const missingEvents = eventSlugs.filter((slug) => !eventMap.has(slug));
    if (missingEvents.length > 0) {
      return next(new BadRequest().handleResponse(res, {
        info: `Events not found: ${missingEvents.join(", ")}`,
      }));
    }

    // Check all venues exist
    const venueSlugs = [...new Set(entries.map((e) => e.venueSlug))];
    const venues = await VenueModel.find({ slug: { $in: venueSlugs } }).lean();
    const venueMap = new Map(venues.map((v) => [v.slug, v]));
    const missingVenues = venueSlugs.filter((slug) => !venueMap.has(slug));
    if (missingVenues.length > 0) {
      return next(new BadRequest().handleResponse(res, {
        info: `Venues not found: ${missingVenues.join(", ")}`,
      }));
    }

    // Check for existing schedule entries
    const existingEntries = await ScheduleEntryModel.find({
      eventSlug: { $in: eventSlugs },
    }).lean();
    if (existingEntries.length > 0) {
      return next(new BadRequest().handleResponse(res, {
        info: `Events already scheduled: ${existingEntries.map((e) => e.eventSlug).join(", ")}`,
      }));
    }

    // Prepare entries with venueId
    const entriesToCreate = entries.map((entry) => ({
      ...entry,
      venueId: venueMap.get(entry.venueSlug)?._id,
    }));

    const createdEntries = await ScheduleEntryModel.insertMany(entriesToCreate);
    // Invalidate all schedule caches (version bump).
    await bumpScheduleCacheVersion();


    logger.info("Bulk schedule entries created", { count: createdEntries.length });

    new CreateResponseStrategy().handleResponse(res, {
      info: `${createdEntries.length} schedule entries created successfully`,
      entries: createdEntries,
      count: createdEntries.length,
    });
  },
);
