import { connInstance } from "../connection.js";
import { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

// ═══════════════════════════════════════════════════════════════════
// ZONAL PASS MODEL
// 
// One document per user per college.
// Contains all passes purchased + unified registration tracking.
// ═══════════════════════════════════════════════════════════════════

/**
 * Individual pass purchase record
 */
const ZonalPassPurchaseSchema = new Schema(
  {
    passType: {
      type: String,
      required: true,
      enum: ["SINGLE_EVENT", "MULTI_EVENT"],
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
    paymentId: { type: String },
    paymentSource: {
      type: String,
      enum: ["konfhub", "razorpay", "manual", "complimentary"],
      default: "konfhub",
    },
    ticketUrl: { type: String },
    invoiceUrl: { type: String },
    purchasedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

/**
 * Main schema - one per user per college
 */
export const ZonalUserCollegeSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    
    collegeSlug: {
      type: String,
      required: true,
      index: true,
    },
    
    // All passes purchased for this college
    passes: {
      type: [ZonalPassPurchaseSchema],
      default: [],
    },
    
    // Effective event limit (updated on each completed purchase)
    // -1 means unlimited (has multi pass)
    eventLimit: {
      type: Number,
      default: 0, // 0 = no valid pass yet
    },
    
    // All registered events (unified across passes)
    registeredEvents: {
      type: [String],
      default: [],
    },
    
    // User snapshot at first purchase
    userSnapshot: {
      email: { type: String },
      name: { type: String },
      phone: { type: String },
      kyId: { type: String },
      college: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

// ═══════════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════════

// One document per user per college
ZonalUserCollegeSchema.index({ userId: 1, collegeSlug: 1 }, { unique: true });

// Query by payment
ZonalUserCollegeSchema.index({ "passes.paymentId": 1 });

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type ZonalUserCollegeSchemaType = InferSchemaType<typeof ZonalUserCollegeSchema> & {
  createdAt: Date;
  updatedAt: Date;
};

export type ZonalUserCollegeDoc = HydratedDocument<ZonalUserCollegeSchemaType>;

export const ZonalUserCollegeModel = connInstance.getModel<ZonalUserCollegeDoc>(
  "ZonalUserCollege",
  ZonalUserCollegeSchema
);
