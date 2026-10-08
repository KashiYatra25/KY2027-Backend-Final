import { z } from "zod";

/**
 * Schema for adding item to cart
 * passId: MongoDB ObjectId of the pass
 * quantity: Number of passes to add (1-50)
 */
export const addToCartSchema = z.object({
  passId: z
    .string()
    .min(1, "Pass ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid pass ID format"),
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1")
    .max(50, "Cannot add more than 50 passes at once"),
});

export type AddToCartSchemaType = z.infer<typeof addToCartSchema>;

/**
 * Schema for updating item quantity in cart
 * passId: MongoDB ObjectId of the pass
 * quantity: New quantity to set (0-50). Setting to 0 removes the item.
 */
export const updateCartQuantitySchema = z.object({
  passId: z
    .string()
    .min(1, "Pass ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid pass ID format"),
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .min(0, "Quantity cannot be negative")
    .max(50, "Cannot have more than 50 passes of one type"),
});

export type UpdateCartQuantitySchemaType = z.infer<typeof updateCartQuantitySchema>;

/**
 * Schema for removing item from cart
 * passId: MongoDB ObjectId of the pass to remove
 */
export const removeFromCartSchema = z.object({
  passId: z
    .string()
    .min(1, "Pass ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid pass ID format"),
});

export type RemoveFromCartSchemaType = z.infer<typeof removeFromCartSchema>;
