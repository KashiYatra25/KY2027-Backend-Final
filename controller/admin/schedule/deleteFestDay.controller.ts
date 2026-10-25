import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound } from "zodex-axon/errors";
import { FestDayModel } from "@root/databaseManagers/mongoose/index.js";
import { logger } from "@logger/logger.js";
import { bumpScheduleCacheVersion } from "@redis/scheduleCache.service.js";
import type { FestDayIdParamRequestSchemaType } from "@schemas/admin/schedule.schema.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// DELETE FEST DAY (Soft Delete - sets active to false)
// ═══════════════════════════════════════════════════════════════════

export const deleteFestDay = catchAsync(
  async (
    req: VerifiedRequest<{ params: FestDayIdParamRequestSchemaType }, AdminRequestWithVerifiedCreds>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { festDayId } = req.validatedParams;

    const festDay = await FestDayModel.findByIdAndUpdate(
      festDayId,
      { active: false },
      { new: true }
    );

    // Invalidate all schedule caches (version bump).
    await bumpScheduleCacheVersion();

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
