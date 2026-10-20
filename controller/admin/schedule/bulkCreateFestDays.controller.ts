import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { CreateResponseStrategy } from "zodex-axon/responses";
import { BadRequest } from "zodex-axon/errors";
import { FestDayModel } from "@root/databaseManagers/mongoose/index.js";
import { logger } from "@logger/logger.js";
import type { CreateFestDayRequestSchemaType } from "@schemas/admin/schedule.schema.js";

// ═══════════════════════════════════════════════════════════════════
// BULK CREATE FEST DAYS
// ═══════════════════════════════════════════════════════════════════

export const bulkCreateFestDays = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { festDays } = req.body as { festDays: CreateFestDayRequestSchemaType[] };

    // Check for duplicate dayNumbers in request
    const dayNumbers = festDays.map((d) => d.dayNumber);
    const uniqueDayNumbers = new Set(dayNumbers);
    if (uniqueDayNumbers.size !== dayNumbers.length) {
      return next(new BadRequest().handleResponse(res, {
        info: "Duplicate day numbers in request",
      }));
    }

    // Check for existing dayNumbers
    const existingDays = await FestDayModel.find({ dayNumber: { $in: dayNumbers } })
      .select("dayNumber")
      .lean();
    if (existingDays.length > 0) {
      return next(new BadRequest().handleResponse(res, {
        info: `Days already exist: ${existingDays.map((d) => d.dayNumber).join(", ")}`,
      }));
    }

    // Convert date strings to Date objects
    const festDaysWithDates = festDays.map((d) => ({
      ...d,
      date: new Date(d.date),
    }));

    const createdFestDays = await FestDayModel.insertMany(festDaysWithDates);

    logger.info("Bulk fest days created", { count: createdFestDays.length });

    new CreateResponseStrategy().handleResponse(res, {
      info: `${createdFestDays.length} fest days created successfully`,
      festDays: createdFestDays,
      count: createdFestDays.length,
    });
  },
);
