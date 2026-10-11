import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { logger } from "@logger/logger.js";
import { CartModel, PassModel } from "@lib/mongo/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import type { AddToCartRequestSchemaType } from "@schemas/user/cart.schema.js";
import { MAX_CART_TOTAL_QUANTITY } from "@controller/user/constants/cart.constants.js";

/**
 * POST /user/cart/add
 * Add a pass to cart or increment quantity if already exists
 */
export const addToCart = catchAsync(
  async (
    req: VerifiedRequest<
      { body: AddToCartRequestSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    next: NextFunction,
  ) => {
    const { id: userId } = req.user;
    const { passId, quantity } = req.validatedData;

    // Verify pass exists and is active
    const pass = await PassModel.findById(passId, { active: true, name: true });
    if (!pass) {
      return next(
        new NotFound().handleResponse(res, {
          info: "Pass not found",
        }),
      );
    }

    if (!pass.active) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "This pass is currently not available for purchase",
        }),
      );
    }

    // Get or create cart
    let cart = await CartModel.findOne({ userId });

    if (!cart) {
      // Create new cart with item
      cart = await CartModel.create({
        userId,
        items: [{ passId, quantity }],
      });

      new OkResponseStrategy().handleResponse(res, {
        info: "Item added to cart",
        items: cart.items,
        totalQuantity: quantity,
      });

      logger.info("Cart created with item", { userId, passId, quantity });
      return;
    }

    // Calculate current total quantity
    const currentTotalQuantity = cart.items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    // Check if adding this quantity exceeds the limit
    const existingItem = cart.items.find((item) => item.passId === passId);
    const additionalQuantity = existingItem
      ? quantity // If item exists, we're adding to it
      : quantity;

    if (currentTotalQuantity + additionalQuantity > MAX_CART_TOTAL_QUANTITY) {
      return next(
        new BadRequest().handleResponse(res, {
          info: `Cannot add ${quantity} items. Maximum ${MAX_CART_TOTAL_QUANTITY} passes allowed in cart. Current total: ${currentTotalQuantity}`,
        }),
      );
    }

    // Update existing item or add new one
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ passId, quantity });
    }

    await cart.save();

    const newTotalQuantity = cart.items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    new OkResponseStrategy().handleResponse(res, {
      info: existingItem ? "Cart item quantity updated" : "Item added to cart",
      items: cart.items,
      totalQuantity: newTotalQuantity,
    });

    logger.info("Cart updated", {
      userId,
      passId,
      quantity,
      totalQuantity: newTotalQuantity,
    });
  },
);
