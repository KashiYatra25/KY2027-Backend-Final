import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound } from "zodex-axon/errors";
import { FestDayModel } from "@root/databaseManagers/mongoose/index.js";
import type { FestDayIdParamRequestSchemaType } from "@schemas/admin/schedule.schema.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// GET FEST DAY BY ID (Admin)
// ═══════════════════════════════════════════════════════════════════

export const getFestDayByIdAdmin = catchAsync(
  async (
    req: VerifiedRequest<{ params: FestDayIdParamRequestSchemaType }, AdminRequestWithVerifiedCreds>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { festDayId } = req.validatedParams;

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
