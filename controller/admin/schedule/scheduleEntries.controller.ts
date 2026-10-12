import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy, CreateResponseStrategy } from "zodex-axon/responses";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { ScheduleEntryModel, VenueModel } from "@root/databaseManagers/mongoose/index.js";
import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";
import type {
  CreateScheduleEntrySchemaType,
  UpdateScheduleEntrySchemaType,
} from "@schemas/admin/schedule.schema.js";

// ═══════════════════════════════════════════════════════════════════
// GET ALL SCHEDULE ENTRIES (Admin)
// ═══════════════════════════════════════════════════════════════════

export const getScheduleEntriesAdmin = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { day, venue, category } = req.query;

    const query: Record<string, unknown> = {};
    if (day) query.day = parseInt(day as string);
    if (venue) query.venueSlug = (venue as string).toLowerCase();
    if (category) query.categorySlug = (category as string).toUpperCase();

    const entries = await ScheduleEntryModel.find(query)
      .populate("venueId")
      .sort({ day: 1, sortOrder: 1 })
      .lean();

    new OkResponseStrategy().handleResponse(res, {
      info: "Schedule entries fetched successfully",
      entries,
      count: entries.length,
    });
  },
);

// ═══════════════════════════════════════════════════════════════════
// GET SINGLE SCHEDULE ENTRY (Admin)
// ═══════════════════════════════════════════════════════════════════

export const getScheduleEntryByIdAdmin = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { scheduleEntryId } = req.params;

    const entry = await ScheduleEntryModel.findById(scheduleEntryId).populate("venueId").lean();

    if (!entry) {
      new NotFound().handleResponse(res, { info: "Schedule entry not found" });
      return;
    }

    new OkResponseStrategy().handleResponse(res, {
      info: "Schedule entry fetched successfully",
      entry,
    });
  },
);

// ═══════════════════════════════════════════════════════════════════
// CREATE SCHEDULE ENTRY
// ═══════════════════════════════════════════════════════════════════

export const createScheduleEntry = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const data = req.body as CreateScheduleEntrySchemaType;

    // Check event exists in Prisma
    const event = await prisma.event.findUnique({
      where: { slug: data.eventSlug },
      select: { id: true, slug: true, category: true },
    });

    if (!event) {
      new BadRequest().handleResponse(res, {
        info: `Event with slug '${data.eventSlug}' not found`,
      });
      return;
    }

    // Check category matches
    if (event.category !== data.categorySlug) {
      new BadRequest().handleResponse(res, {
        info: `Event category mismatch. Event is '${event.category}', provided '${data.categorySlug}'`,
      });
      return;
    }

    // Check venue exists
    const venue = await VenueModel.findOne({ slug: data.venueSlug });
    if (!venue) {
      new BadRequest().handleResponse(res, {
        info: `Venue with slug '${data.venueSlug}' not found`,
      });
      return;
    }

    // Check for duplicate eventSlug (one schedule per event)
    const existing = await ScheduleEntryModel.findOne({ eventSlug: data.eventSlug });
    if (existing) {
      new BadRequest().handleResponse(res, {
        info: `Event '${data.eventSlug}' is already scheduled`,
      });
      return;
    }

    const entry = await ScheduleEntryModel.create({
      ...data,
      venueId: venue._id,
    });

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

// ═══════════════════════════════════════════════════════════════════
// UPDATE SCHEDULE ENTRY
// ═══════════════════════════════════════════════════════════════════

export const updateScheduleEntry = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { scheduleEntryId } = req.params;
    const data = req.body as UpdateScheduleEntrySchemaType;

    const existingEntry = await ScheduleEntryModel.findById(scheduleEntryId);
    if (!existingEntry) {
      new NotFound().handleResponse(res, { info: "Schedule entry not found" });
      return;
    }

    const updateData: Record<string, unknown> = { ...data };

    // If updating eventSlug, validate it
    if (data.eventSlug && data.eventSlug !== existingEntry.eventSlug) {
      const event = await prisma.event.findUnique({
        where: { slug: data.eventSlug },
        select: { id: true, category: true },
      });

      if (!event) {
        new BadRequest().handleResponse(res, {
          info: `Event with slug '${data.eventSlug}' not found`,
        });
        return;
      }

      // Check for duplicate
      const duplicate = await ScheduleEntryModel.findOne({
        eventSlug: data.eventSlug,
        _id: { $ne: scheduleEntryId },
      });
      if (duplicate) {
        new BadRequest().handleResponse(res, {
          info: `Event '${data.eventSlug}' is already scheduled`,
        });
        return;
      }

      // Update category to match event
      updateData.categorySlug = event.category;
    }

    // If updating venueSlug, get venueId
    if (data.venueSlug) {
      const venue = await VenueModel.findOne({ slug: data.venueSlug });
      if (!venue) {
        new BadRequest().handleResponse(res, {
          info: `Venue with slug '${data.venueSlug}' not found`,
        });
        return;
      }
      updateData.venueId = venue._id;
    }

    const entry = await ScheduleEntryModel.findByIdAndUpdate(
      scheduleEntryId,
      { $set: updateData },
      { new: true, runValidators: true },
    ).populate("venueId");

    logger.info("Schedule entry updated", { entryId: entry?._id });

    new OkResponseStrategy().handleResponse(res, {
      info: "Schedule entry updated successfully",
      entry,
    });
  },
);

// ═══════════════════════════════════════════════════════════════════
// DELETE SCHEDULE ENTRY
// ═══════════════════════════════════════════════════════════════════
// DELETE SCHEDULE ENTRY (Soft Delete - sets active to false)
// ═══════════════════════════════════════════════════════════════════

export const deleteScheduleEntry = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { scheduleEntryId } = req.params;

    const entry = await ScheduleEntryModel.findByIdAndUpdate(
      scheduleEntryId,
      { active: false },
      { new: true }
    );

    if (!entry) {
      new NotFound().handleResponse(res, { info: "Schedule entry not found" });
      return;
    }

    logger.info("Schedule entry deactivated", { entryId: entry._id, eventSlug: entry.eventSlug });

    new OkResponseStrategy().handleResponse(res, {
      info: "Schedule entry deactivated successfully",
      entry,
    });
  },
);

// ═══════════════════════════════════════════════════════════════════
// BULK CREATE SCHEDULE ENTRIES
// ═══════════════════════════════════════════════════════════════════

export const bulkCreateScheduleEntries = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { entries } = req.body as { entries: CreateScheduleEntrySchemaType[] };

    // Check for duplicate eventSlugs in request
    const eventSlugs = entries.map((e) => e.eventSlug);
    const uniqueEventSlugs = new Set(eventSlugs);
    if (uniqueEventSlugs.size !== eventSlugs.length) {
      new BadRequest().handleResponse(res, {
        info: "Duplicate event slugs in request",
      });
      return;
    }

    // Check all events exist
    const events = await prisma.event.findMany({
      where: { slug: { in: eventSlugs } },
      select: { slug: true, category: true },
    });

    const eventMap = new Map(events.map((e) => [e.slug, e]));
    const missingEvents = eventSlugs.filter((slug) => !eventMap.has(slug));
    if (missingEvents.length > 0) {
      new BadRequest().handleResponse(res, {
        info: `Events not found: ${missingEvents.join(", ")}`,
      });
      return;
    }

    // Check all venues exist
    const venueSlugs = [...new Set(entries.map((e) => e.venueSlug))];
    const venues = await VenueModel.find({ slug: { $in: venueSlugs } }).lean();
    const venueMap = new Map(venues.map((v) => [v.slug, v]));
    const missingVenues = venueSlugs.filter((slug) => !venueMap.has(slug));
    if (missingVenues.length > 0) {
      new BadRequest().handleResponse(res, {
        info: `Venues not found: ${missingVenues.join(", ")}`,
      });
      return;
    }

    // Check for existing schedule entries
    const existingEntries = await ScheduleEntryModel.find({
      eventSlug: { $in: eventSlugs },
    }).lean();
    if (existingEntries.length > 0) {
      new BadRequest().handleResponse(res, {
        info: `Events already scheduled: ${existingEntries.map((e) => e.eventSlug).join(", ")}`,
      });
      return;
    }

    // Prepare entries with venueId
    const entriesToCreate = entries.map((entry) => ({
      ...entry,
      venueId: venueMap.get(entry.venueSlug)?._id,
    }));

    const createdEntries = await ScheduleEntryModel.insertMany(entriesToCreate);

    logger.info("Bulk schedule entries created", { count: createdEntries.length });

    new CreateResponseStrategy().handleResponse(res, {
      info: `${createdEntries.length} schedule entries created successfully`,
      entries: createdEntries,
      count: createdEntries.length,
    });
  },
);
