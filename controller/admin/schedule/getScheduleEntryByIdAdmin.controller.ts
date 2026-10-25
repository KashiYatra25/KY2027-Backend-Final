import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound } from "zodex-axon/errors";
import { ScheduleEntryModel } from "@root/databaseManagers/mongoose/index.js";
import type { ScheduleEntryIdParamRequestSchemaType } from "@schemas/admin/schedule.schema.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// GET SCHEDULE ENTRY BY ID (Admin)
// ═══════════════════════════════════════════════════════════════════

export const getScheduleEntryByIdAdmin = catchAsync(
  async (
    req: VerifiedRequest<{ params: ScheduleEntryIdParamRequestSchemaType }, AdminRequestWithVerifiedCreds>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { scheduleEntryId } = req.validatedParams;

    const entry = await ScheduleEntryModel.findById(scheduleEntryId)
      .populate("venueId")
      .lean();

    if (!entry) {
      return next(new NotFound().handleResponse(res, { info: "Schedule entry not found" }));
    }

    new OkResponseStrategy().handleResponse(res, {
      info: "Schedule entry fetched successfully",
      entry,
    });
  },
);
