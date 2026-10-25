import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { CreateResponseStrategy } from "zodex-axon/responses";
import { FestDayModel } from "@root/databaseManagers/mongoose/index.js";
import { logger } from "@logger/logger.js";
import { bumpScheduleCacheVersion } from "@redis/scheduleCache.service.js";
import type { BulkCreateFestDaysRequestSchemaType } from "@schemas/admin/schedule.schema.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// BULK CREATE FEST DAYS
// ═══════════════════════════════════════════════════════════════════

export const bulkCreateFestDays = catchAsync(
  async (
    req: VerifiedRequest<{ body: BulkCreateFestDaysRequestSchemaType }, AdminRequestWithVerifiedCreds>,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { festDays } = req.validatedData;

    const created = await FestDayModel.insertMany(festDays, { ordered: false });

    // Invalidate all schedule caches (version bump).
    await bumpScheduleCacheVersion();

    logger.info("Bulk fest days created", { count: created.length });

    new CreateResponseStrategy().handleResponse(res, {
      info: `${created.length} fest days created successfully`,
      festDays: created,
    });
  },
);
