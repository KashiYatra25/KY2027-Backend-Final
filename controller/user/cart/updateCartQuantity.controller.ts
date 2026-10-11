import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { logger } from "@logger/logger.js";
import { CartModel } from "@lib/mongo/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import type { UpdateCartQuantityRequestSchemaType } from "@schemas/user/cart.schema.js";
import { MAX_CART_TOTAL_QUANTITY } from "@controller/user/constants/cart.constants.js";

/**
 * PATCH /user/cart/update-quantity
 * Update the quantity of a specific pass in the cart
 * - Sets the quantity to the exact value provided (doesn't increment)
 * - If quantity is 0, removes the item from cart
 */
export const updateCartQuantity = catchAsync(
  async (
    req: VerifiedRequest<
      { body: UpdateCartQuantityRequestSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    next: NextFunction,
  ) => {
    const { id: userId } = req.user;
    const { passId, quantity } = req.validatedData;

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

    // If quantity is 0, remove the item
    if (quantity === 0) {
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

      logger.info("Item removed from cart (quantity set to 0)", {
        userId,
        passId,
      });
      return;
    }

    // Calculate what the new total would be
    const currentItem = cart.items[itemIndex];
    if (!currentItem) {
      return next(
        new NotFound().handleResponse(res, {
          info: "Item not found in cart",
        }),
      );
    }

    const currentItemQuantity = currentItem.quantity;
    const otherItemsQuantity = cart.items.reduce(
      (sum, item, idx) => (idx === itemIndex ? sum : sum + item.quantity),
      0,
    );

    if (otherItemsQuantity + quantity > MAX_CART_TOTAL_QUANTITY) {
      return next(
        new BadRequest().handleResponse(res, {
          info: `Cannot set quantity to ${quantity}. Maximum ${MAX_CART_TOTAL_QUANTITY} passes allowed in cart. Other items total: ${otherItemsQuantity}`,
        }),
      );
    }

    // Update the quantity
    currentItem.quantity = quantity;
    await cart.save();

    const totalQuantity = cart.items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    new OkResponseStrategy().handleResponse(res, {
      info: "Cart quantity updated",
      items: cart.items,
      totalQuantity,
    });

    logger.info("Cart quantity updated", {
      userId,
      passId,
      oldQuantity: currentItemQuantity,
      newQuantity: quantity,
      totalQuantity,
    });
  },
);
