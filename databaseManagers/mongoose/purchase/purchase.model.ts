import { connInstance } from "../connection.js";
import { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

// ═══════════════════════════════════════════════════════════════════
// PURCHASE MODEL
// Tracks purchases - from pending to completed/failed
// ═══════════════════════════════════════════════════════════════════

const PurchaseItemSchema = new Schema(
  {
    passId: {
      type: String,
      required: true,
    },
    passName: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
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
    paymentSessionId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["PENDING", "PAID", "FAILED", "EXPIRED"],
      default: "PENDING",
    },
    items: {
      type: [PurchaseItemSchema],
      required: true,
    },
    // Amounts stored in INR (not paise)
    subtotal: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    // Coupon tracking
    couponId: {
      type: String,
      default: null,
    },
    couponCode: {
      type: String,
      default: null,
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ["EXTERNAL", "WEB_APP"],
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

PurchaseSchema.index({ userId: 1 });
// orderId already has unique: true which creates an index
PurchaseSchema.index({ userId: 1, status: 1 });
PurchaseSchema.index({ status: 1, createdAt: 1 }); // For cleanup of expired pending orders

export type PurchaseSchemaType = InferSchemaType<typeof PurchaseSchema> & {
  createdAt: Date;
  updatedAt: Date;
};

export type PurchaseDoc = HydratedDocument<PurchaseSchemaType>;

export const PurchaseModel = connInstance.getModel<PurchaseDoc>("Purchase", PurchaseSchema);
