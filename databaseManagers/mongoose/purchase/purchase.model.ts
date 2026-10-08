import { connInstance } from "../connection.js";
import { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

// ═══════════════════════════════════════════════════════════════════
// PURCHASE MODEL
// Tracks completed purchases - one document per order/transaction
// ═══════════════════════════════════════════════════════════════════

const PurchaseItemSchema = new Schema(
  {
    passId: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

export const PurchaseSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    orderId: {
      type: String,
      required: true,
      unique: true,
    },
    items: {
      type: [PurchaseItemSchema],
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    couponId: {
      type: String,
      default: null,
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ["EXTERNAL", "WEB_APP", "IIT_BHU_FREE"],
    },
    purchasedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

PurchaseSchema.index({ userId: 1 });
PurchaseSchema.index({ orderId: 1 });
PurchaseSchema.index({ userId: 1, purchasedAt: -1 });

export type PurchaseSchemaType = InferSchemaType<typeof PurchaseSchema> & {
  createdAt: Date;
  updatedAt: Date;
};

export type PurchaseDoc = HydratedDocument<PurchaseSchemaType>;

export const PurchaseModel = connInstance.getModel<PurchaseDoc>("Purchase", PurchaseSchema);
