import type { Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { CartModel } from "@lib/mongo/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/auth.types.helper.js";

/**
 * GET /user/cart
 * Get user's cart with all items
 */
export const getCart = catchAsync(
  async (
    req: AuthenticatedUserRequestWithVerifiedEmail,
    res: Response,
  ) => {
    const { id: userId } = req.user;

    const cart = await CartModel.findOne({ userId }).lean();

    if (!cart || cart.items.length === 0) {
      new OkResponseStrategy().handleResponse(res, {
        info: "Cart retrieved successfully",
        data: {
          items: [],
          totalQuantity: 0,
        },
      });
      return;
    }

    const totalQuantity = cart.items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    new OkResponseStrategy().handleResponse(res, {
      info: "Cart retrieved successfully",
      data: {
        items: cart.items,
        totalQuantity,
      },
    });
  },
);
