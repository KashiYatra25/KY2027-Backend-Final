import { connInstance } from "@lib/mongo/connection.js";
import { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

// ═══════════════════════════════════════════════════════════════════
// MANUAL PAYMENT REQUEST MODEL
// 
// Admin-created bulk payment requests for users who paid offline.
// Workflow: Admin creates request → MASTER_ADMIN approves/rejects
// ═══════════════════════════════════════════════════════════════════

/**
 * User details for manual payment
 */
const ManualPaymentUserSchema = new Schema(
  {
    userId: { type: String, required: true },
    kyId: { type: String, required: true },
    email: { type: String, required: true },
  },
  { _id: false }
);

/**
 * Main Manual Payment Request Schema
 */
export const ManualPaymentRequestSchema = new Schema(
  {
    // Unique request ID (auto-generated)
    requestId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Admin who created this request (store full info for history)
    requestedBy: {
      type: String,
      required: true,
      index: true,
    },
    requestedByName: {
      type: String,
      default: null,
    },
    requestedByRole: {
      type: String,
      enum: ["MASTER_ADMIN", "MANAGER", "OPERATOR"],
      default: null,
    },

    // Users this payment covers
    users: {
      type: [ManualPaymentUserSchema],
      required: true,
      validate: {
        validator: (v: any[]) => v.length > 0,
        message: "At least one user is required",
      },
    },

    // Number of passes (derived from users.length)
    numberOfPasses: {
      type: Number,
      required: true,
      min: 1,
    },

    // Pass type
    passType: {
      type: String,
      required: true,
      enum: ["DARBAR", "YATRI", "SWARNIM", "ZONAL_SINGLE", "ZONAL_MULTI"],
    },

    // College slug (required for zonal passes)
    collegeSlug: {
      type: String,
      default: null,
    },

    // Payment details
    paymentMethod: {
      type: String,
      required: true,
      enum: ["UPI", "NETBANKING", "WALLET", "CASH"],
    },

    // Total amount paid
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // R2 keys for uploaded bonafide/payment proof files
    bonafides: {
      type: [String],
      default: [],
    },

    // Request status
    status: {
      type: String,
      required: true,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },

    // Processing details (who approved/rejected)
    processedBy: {
      type: String,
      default: null,
    },
    processedByName: {
      type: String,
      default: null,
    },
    processedByRole: {
      type: String,
      enum: ["MASTER_ADMIN", "MANAGER", "OPERATOR"],
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    processNote: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ═══════════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════════

// Query by status and date
ManualPaymentRequestSchema.index({ status: 1, createdAt: -1 });

// Query by requestor
ManualPaymentRequestSchema.index({ requestedBy: 1, createdAt: -1 });

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type ManualPaymentRequestSchemaType = InferSchemaType<typeof ManualPaymentRequestSchema> & {
  createdAt: Date;
  updatedAt: Date;
};

export type ManualPaymentRequestDoc = HydratedDocument<ManualPaymentRequestSchemaType>;

export const ManualPaymentRequestModel = connInstance.getModel<ManualPaymentRequestDoc>(
  "ManualPaymentRequest",
  ManualPaymentRequestSchema
);
