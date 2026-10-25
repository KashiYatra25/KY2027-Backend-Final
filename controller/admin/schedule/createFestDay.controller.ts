import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { CreateResponseStrategy } from "zodex-axon/responses";
import { BadRequest } from "zodex-axon/errors";
import { FestDayModel } from "@root/databaseManagers/mongoose/index.js";
import { logger } from "@logger/logger.js";
import { bumpScheduleCacheVersion } from "@redis/scheduleCache.service.js";
import type { CreateFestDayRequestSchemaType } from "@schemas/admin/schedule.schema.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// CREATE FEST DAY
// ═══════════════════════════════════════════════════════════════════

export const createFestDay = catchAsync(
  async (
    req: VerifiedRequest<{ body: CreateFestDayRequestSchemaType }, AdminRequestWithVerifiedCreds>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const data = req.validatedData;

    // Check for duplicate day number
    const existing = await FestDayModel.findOne({ dayNumber: data.dayNumber });
    if (existing) {
      return next(new BadRequest().handleResponse(res, {
        info: "Fest day with this day number already exists",
      }));
    }

    const festDay = await FestDayModel.create(data);

    // Invalidate all schedule caches (version bump).
    await bumpScheduleCacheVersion();

    logger.info("Fest day created", { festDayId: festDay._id, dayNumber: festDay.dayNumber });

    new CreateResponseStrategy().handleResponse(res, {
      info: "Fest day created successfully",
      festDay,
    });
  },
);
