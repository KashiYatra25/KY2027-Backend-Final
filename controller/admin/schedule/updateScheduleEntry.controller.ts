import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { ScheduleEntryModel, VenueModel } from "@root/databaseManagers/mongoose/index.js";
import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";
import type { UpdateScheduleEntryRequestSchemaType } from "@schemas/admin/schedule.schema.js";

// ═══════════════════════════════════════════════════════════════════
// UPDATE SCHEDULE ENTRY
// ═══════════════════════════════════════════════════════════════════

export const updateScheduleEntry = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { scheduleEntryId } = req.params;
    const data = req.body as UpdateScheduleEntryRequestSchemaType;

    const existingEntry = await ScheduleEntryModel.findById(scheduleEntryId);
    if (!existingEntry) {
      return next(new NotFound().handleResponse(res, { info: "Schedule entry not found" }));
    }

    const updateData: Record<string, unknown> = { ...data };

    // If updating eventSlug, validate it
    if (data.eventSlug && data.eventSlug !== existingEntry.eventSlug) {
      const event = await prisma.event.findUnique({
        where: { slug: data.eventSlug },
        select: { id: true, category: true },
      });

      if (!event) {
        return next(new BadRequest().handleResponse(res, {
          info: `Event with slug '${data.eventSlug}' not found`,
        }));
      }

      // Check for duplicate
      const duplicate = await ScheduleEntryModel.findOne({
        eventSlug: data.eventSlug,
        _id: { $ne: scheduleEntryId },
      });
      if (duplicate) {
        return next(new BadRequest().handleResponse(res, {
          info: `Event '${data.eventSlug}' is already scheduled`,
        }));
      }

      // Update category to match event
      updateData.categorySlug = event.category;
    }

    // If updating venueSlug, get venueId
    if (data.venueSlug) {
      const venue = await VenueModel.findOne({ slug: data.venueSlug });
      if (!venue) {
        return next(new BadRequest().handleResponse(res, {
          info: `Venue with slug '${data.venueSlug}' not found`,
        }));
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
