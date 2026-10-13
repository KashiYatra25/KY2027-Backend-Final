import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy, CreateResponseStrategy } from "zodex-axon/responses";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { FestDayModel } from "@root/databaseManagers/mongoose/index.js";
import { logger } from "@logger/logger.js";
import type {
  CreateFestDayRequestSchemaType,
  UpdateFestDayRequestSchemaType,
} from "@schemas/admin/schedule.schema.js";

// ═══════════════════════════════════════════════════════════════════
// GET ALL FEST DAYS (Admin)
// ═══════════════════════════════════════════════════════════════════

export const getFestDaysAdmin = catchAsync(
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    const festDays = await FestDayModel.find().sort({ dayNumber: 1 }).lean();

    new OkResponseStrategy().handleResponse(res, {
      info: "Fest days fetched successfully",
      festDays,
      count: festDays.length,
    });
  },
);

// ═══════════════════════════════════════════════════════════════════
// GET SINGLE FEST DAY (Admin)
// ═══════════════════════════════════════════════════════════════════

export const getFestDayByIdAdmin = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { festDayId } = req.params;

    const festDay = await FestDayModel.findById(festDayId).lean();

    if (!festDay) {
      return next(new NotFound().handleResponse(res, { info: "Fest day not found" }));
    }

    new OkResponseStrategy().handleResponse(res, {
      info: "Fest day fetched successfully",
      festDay,
    });
  },
);

// ═══════════════════════════════════════════════════════════════════
// CREATE FEST DAY
// ═══════════════════════════════════════════════════════════════════

export const createFestDay = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const data = req.body as CreateFestDayRequestSchemaType;

    // Check for duplicate dayNumber
    const existing = await FestDayModel.findOne({ dayNumber: data.dayNumber });
    if (existing) {
      return next(new BadRequest().handleResponse(res, {
        info: `Day ${data.dayNumber} already exists`,
      }));
    }

    const festDay = await FestDayModel.create({
      ...data,
      date: new Date(data.date),
    });

    logger.info("Fest day created", { festDayId: festDay._id, dayNumber: festDay.dayNumber });

    new CreateResponseStrategy().handleResponse(res, {
      info: "Fest day created successfully",
      festDay,
    });
  },
);

// ═══════════════════════════════════════════════════════════════════
// UPDATE FEST DAY
// ═══════════════════════════════════════════════════════════════════

export const updateFestDay = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { festDayId } = req.params;
    const data = req.body as UpdateFestDayRequestSchemaType;

    // If updating dayNumber, check for conflicts
    if (data.dayNumber) {
      const existing = await FestDayModel.findOne({
        dayNumber: data.dayNumber,
        _id: { $ne: festDayId },
      });
      if (existing) {
        return next(new BadRequest().handleResponse(res, {
          info: `Day ${data.dayNumber} already exists`,
        }));
      }
    }

    const updateData = { ...data };
    if (data.date) {
      (updateData as Record<string, unknown>).date = new Date(data.date);
    }

    const festDay = await FestDayModel.findByIdAndUpdate(
      festDayId,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (!festDay) {
      return next(new NotFound().handleResponse(res, { info: "Fest day not found" }));
    }

    logger.info("Fest day updated", { festDayId: festDay._id, dayNumber: festDay.dayNumber });

    new OkResponseStrategy().handleResponse(res, {
      info: "Fest day updated successfully",
      festDay,
    });
  },
);

// ═══════════════════════════════════════════════════════════════════
// DELETE FEST DAY
// ═══════════════════════════════════════════════════════════════════
// DELETE FEST DAY (Soft Delete - sets active to false)
// ═══════════════════════════════════════════════════════════════════

export const deleteFestDay = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { festDayId } = req.params;

    const festDay = await FestDayModel.findByIdAndUpdate(
      festDayId,
      { active: false },
      { new: true }
    );

    if (!festDay) {
      return next(new NotFound().handleResponse(res, { info: "Fest day not found" }));
    }

    logger.info("Fest day deactivated", { festDayId: festDay._id, dayNumber: festDay.dayNumber });

    new OkResponseStrategy().handleResponse(res, {
      info: "Fest day deactivated successfully",
      festDay,
    });
  },
);

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
