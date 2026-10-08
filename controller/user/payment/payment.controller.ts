import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@utils/helper/auth.types.helper.js";

/**
 * GET /user/payment-status
 * Check if the current user has paid (isPaidUser = true)
 * Note: IIT BHU users get isPaidUser = true on signup
 */
export const getPaymentStatus = catchAsync(
  async (
    req: VerifiedRequest<Record<string, never>, AuthenticatedUserRequestWithVerifiedEmail>,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { id: userId } = req.user;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPaidUser: true, isFromIITBhu: true },
    });

    const hasPaid = user?.isPaidUser ?? false;

    new OkResponseStrategy().handleResponse(res, {
      info: hasPaid ? "User has paid" : "User has not paid",
      data: {
        hasPaid,
        isIITBhuUser: user?.isFromIITBhu ?? false,
      },
    });
  },
);
