import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound } from "zodex-axon/errors";
import { logger } from "@logger/index.js";
import { CartModel } from "@lib/mongo/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/auth.types.helper.js";
import type { RemoveFromCartSchemaType } from "@schemas/user/cart.schema.js";

/**
 * DELETE /user/cart/remove
 * Remove a pass from cart completely
 */
export const removeFromCart = catchAsync(
  async (
    req: VerifiedRequest<
      { body: RemoveFromCartSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    next: NextFunction,
  ) => {
    const { id: userId } = req.user;
    const { passId } = req.validatedData;

    const cart = await CartModel.findOne({ userId });

    if (!cart) {
      return next(
        new NotFound().handleResponse(res, {
          info: "Cart not found",
        }),
      );
    }

    const itemIndex = cart.items.findIndex((item) => item.passId === passId);

    if (itemIndex === -1) {
      return next(
        new NotFound().handleResponse(res, {
          info: "Item not found in cart",
        }),
      );
    }

    // Remove the item
    cart.items.splice(itemIndex, 1);
    await cart.save();

    const totalQuantity = cart.items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    new OkResponseStrategy().handleResponse(res, {
      info: "Item removed from cart",
      items: cart.items,
      totalQuantity,
    });

    logger.info("Item removed from cart", { userId, passId });
  },
);
