import type { Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { PurchaseModel } from "@root/databaseManagers/mongoose/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";

// ═══════════════════════════════════════════════════════════════════
// GET MY PAYMENT REQUEST STATUS (User)
// Returns the user's payment verification requests (manual flow)
// ═══════════════════════════════════════════════════════════════════

export const getMyPaymentRequestStatus = catchAsync(
  async (req: AuthenticatedUserRequestWithVerifiedEmail, res: Response) => {
    const { id: userId } = req.user;

    const purchases = await PurchaseModel.find({ userId })
      .sort({ createdAt: -1 })
      .select({
        _id: 1,
        source: 1,
        passType: 1,
        status: 1,
        benefits: 1,
        createdAt: 1,
        "manualVerification.verifiedAt": 1,
        "manualVerification.rejectedAt": 1,
        "manualVerification.rejectionReason": 1,
      })
      .lean();

    new OkResponseStrategy().handleResponse(res, {
      info: "Payment requests fetched",
      purchases,
    });
  },
);
