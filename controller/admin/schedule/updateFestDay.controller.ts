import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { FestDayModel } from "@root/databaseManagers/mongoose/index.js";
import { logger } from "@logger/logger.js";
import type { UpdateFestDayRequestSchemaType } from "@schemas/admin/schedule.schema.js";

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
