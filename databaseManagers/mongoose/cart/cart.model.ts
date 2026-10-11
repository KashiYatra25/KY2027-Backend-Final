import { connInstance } from "../connection.js";
import { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

// ═══════════════════════════════════════════════════════════════════
// CART MODEL
// User's shopping cart with pass items and quantities
// ═══════════════════════════════════════════════════════════════════

const CartItemSchema = new Schema(
  {
    passId: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
      max: [50, "Quantity cannot exceed 50 per pass"],
    },
  },
  { _id: false }
);

export const CartSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
    },
    items: {
      type: [CartItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// userId already has unique: true which creates an index

export type CartSchemaType = InferSchemaType<typeof CartSchema> & {
  createdAt: Date;
  updatedAt: Date;
};

export type CartDoc = HydratedDocument<CartSchemaType>;

export const CartModel = connInstance.getModel<CartDoc>("Cart", CartSchema);
