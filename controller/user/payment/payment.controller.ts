import type { NextFunction, Request, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { PurchaseModel } from "@root/databaseManagers/mongoose/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@utils/helper/auth.types.helper.js";

/**
 * GET /user/payment-status
 * Check if the current user has paid (has any purchase record)
 * Note: IIT BHU users get auto-created purchase on first login
 */
export const getPaymentStatus = catchAsync(
  async (
    req: Request,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const authReq = req as AuthenticatedUserRequestWithVerifiedEmail;
    const userId = authReq.user.id;

    // Check if user has any purchase (includes IIT_BHU_FREE)
    const purchase = await PurchaseModel.findOne({ userId }).lean();
    const hasPaid = !!purchase;

    new OkResponseStrategy().handleResponse(res, {
      info: hasPaid ? "User has paid" : "User has not paid",
      data: {
        hasPaid,
        paymentMethod: purchase?.paymentMethod ?? null,
        purchasedAt: purchase?.purchasedAt ?? null,
      },
    });
  },
);
