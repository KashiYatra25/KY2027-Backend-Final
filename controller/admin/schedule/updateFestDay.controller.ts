import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound } from "zodex-axon/errors";
import { FestDayModel } from "@root/databaseManagers/mongoose/index.js";
import { logger } from "@logger/logger.js";
import { bumpScheduleCacheVersion } from "@redis/scheduleCache.service.js";
import type {
  UpdateFestDayRequestSchemaType,
  FestDayIdParamRequestSchemaType,
} from "@schemas/admin/schedule.schema.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// UPDATE FEST DAY
// ═══════════════════════════════════════════════════════════════════

export const updateFestDay = catchAsync(
  async (
    req: VerifiedRequest<
      { body: UpdateFestDayRequestSchemaType; params: FestDayIdParamRequestSchemaType },
      AdminRequestWithVerifiedCreds
    >,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { festDayId } = req.validatedParams;
    const data = req.validatedData;

    const festDay = await FestDayModel.findByIdAndUpdate(
      festDayId,
      { $set: data },
      { new: true, runValidators: true },
    );

    // Invalidate all schedule caches (version bump).
    await bumpScheduleCacheVersion();

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
