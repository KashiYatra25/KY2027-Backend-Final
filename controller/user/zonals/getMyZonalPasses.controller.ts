import type { Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { ZonalUserCollegeModel } from "@root/databaseManagers/mongoose/zonals/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";

// ═══════════════════════════════════════════════════════════════════
// GET MY ZONAL PASSES
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /zonals/my-passes
 */
export const getMyZonalPasses = catchAsync(
  async (req: AuthenticatedUserRequestWithVerifiedEmail, res: Response): Promise<void> => {
    const userId = req.user.id;

    const docs = await ZonalUserCollegeModel.find({ userId })
      .select("-userSnapshot -__v")
      .lean();

    const result = docs.map((doc) => ({
      collegeSlug: doc.collegeSlug,
      passes: doc.passes.map((p) => ({
        passType: p.passType,
        amount: p.amount,
        paymentStatus: p.paymentStatus,
        ticketUrl: p.ticketUrl ?? undefined,
        invoiceUrl: p.invoiceUrl ?? undefined,
        purchasedAt: p.purchasedAt,
      })),
      eventLimit: doc.eventLimit, // -1 = unlimited
      registeredEvents: doc.registeredEvents,
    }));

    new OkResponseStrategy().handleResponse(res, {
      info: "Zonal passes fetched successfully",
      colleges: result,
      count: result.length,
    });
  }
);
