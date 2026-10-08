import type { Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { logger } from "@logger/index.js";
import { CartModel } from "@lib/mongo/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/auth.types.helper.js";

/**
 * DELETE /user/cart/clear
 * Remove all items from cart
 */
export const clearCart = catchAsync(
  async (
    req: AuthenticatedUserRequestWithVerifiedEmail,
    res: Response,
  ) => {
    const { id: userId } = req.user;

    const cart = await CartModel.findOne({ userId });

    if (!cart || cart.items.length === 0) {
      new OkResponseStrategy().handleResponse(res, {
        info: "Cart is already empty",
        data: {
          items: [],
          totalQuantity: 0,
        },
      });
      return;
    }

    // Clear all items
    cart.items.splice(0, cart.items.length);
    await cart.save();

    new OkResponseStrategy().handleResponse(res, {
      info: "Cart cleared successfully",
      data: {
        items: [],
        totalQuantity: 0,
      },
    });

    logger.info("Cart cleared", { userId });
  },
);
