import { connInstance } from "../connection.js";
import { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

// ═══════════════════════════════════════════════════════════════════
// PURCHASE MODEL
// Tracks pass purchases from multiple sources:
// - KonfHub webhooks (online payment)
// - Manual verification (QR/UPI payments verified by admin)
// ═══════════════════════════════════════════════════════════════════

/**
 * Pass Benefits Schema (embedded)
 * Flexible benefits that can be customized per purchase
 */
const PassBenefitsSchema = new Schema(
  {
    // Core access
    festivalEntry: { type: Boolean, default: true },
    allDaysAccess: { type: Boolean, default: true },
    
    // Pro-nite access
    proNiteAccess: { type: Boolean, default: false },
    proNiteSeating: { 
      type: String, 
      enum: ["none", "general", "priority", "vip"], 
      default: "none" 
    },
    
    // Merchandise & goodies
    welcomeKit: { type: Boolean, default: false },
    tshirt: { type: Boolean, default: false },
    merchandise: { type: Boolean, default: false },
    
    // Food & hospitality
    mealsIncluded: { type: Number, default: 0 }, // Number of meals
    refreshments: { type: Boolean, default: false },
    
    // Special access
    backstageAccess: { type: Boolean, default: false },
    workshopAccess: { type: Boolean, default: false },
    meetAndGreet: { type: Boolean, default: false },
    
    // Accommodation
    accommodationIncluded: { type: Boolean, default: false },
    accommodationType: { type: String, default: null },
    
    // Custom benefits (for flexibility)
    custom: [{
      name: { type: String, required: true },
      description: { type: String },
      value: { type: Schema.Types.Mixed }, // Can be boolean, number, string
    }],
  },
  { _id: false }
);

/**
 * Main Purchase Schema
 */
export const PurchaseSchema = new Schema(
  {
    // ═══════════════════════════════════════════════════════════════
    // USER REFERENCE
    // ═══════════════════════════════════════════════════════════════
    
    // Our user ID (Prisma User.id)
    userId: {
      type: String,
      required: true,
      index: true,
    },
    
    // ═══════════════════════════════════════════════════════════════
    // PURCHASE SOURCE
    // ═══════════════════════════════════════════════════════════════
    
    // How this purchase was made
    source: {
      type: String,
      required: true,
      enum: ["konfhub", "manual_qr", "manual_cash", "manual_other", "complimentary"],
      index: true,
    },
    
    // ═══════════════════════════════════════════════════════════════
    // PASS DETAILS
    // ═══════════════════════════════════════════════════════════════
    
    // Pass type name (e.g., "Yatri Pass", "Swarnim Pass", "Darbar Pass", or custom)
    passType: {
      type: String,
      required: true,
      index: true,
    },
    
    // Amount paid (in paise/cents for precision)
    amountPaid: {
      type: Number,
      required: true,
      default: 0,
    },
    
    // Currency
    currency: {
      type: String,
      default: "INR",
    },
    
    // Benefits included with this purchase
    benefits: {
      type: PassBenefitsSchema,
      default: () => ({}),
    },
    
    // ═══════════════════════════════════════════════════════════════
    // STATUS
    // ═══════════════════════════════════════════════════════════════
    
    status: {
      type: String,
      required: true,
      enum: [
        "PENDING_VERIFICATION", // Manual payment awaiting admin verification
        "VERIFIED",             // Active/verified purchase
        "CANCELLED",            // Cancelled/refunded
        "CHECKED_IN",           // User checked in at event
        "CHECKED_OUT",          // User checked out
        "REJECTED",             // Manual payment rejected by admin
      ],
      default: "PENDING_VERIFICATION",
      index: true,
    },
    
    // ═══════════════════════════════════════════════════════════════
    // KONFHUB-SPECIFIC FIELDS
    // Only populated for source="konfhub"
    // ═══════════════════════════════════════════════════════════════
    
    konfhub: {
      // Identifiers
      webhookId: { type: String },               // KonfHub webhook UUID
      bookingId: { type: String, sparse: true, unique: true }, // KonfHub booking ID
      
      // Attendee info
      attendeeEmail: { type: String },
      attendeeName: { type: String },
      attendeePhone: { type: String },
      
      // Ticket info
      ticketName: { type: String },              // Original ticket name from KonfHub
      ticketPrice: { type: Number },             // Original ticket price
      paymentId: { type: String },               // Razorpay/payment gateway ID
      
      // URLs from KonfHub
      ticketUrl: { type: String },               // PDF ticket URL
      invoiceUrl: { type: String },              // PDF invoice URL
      
      // Optional fields
      teamName: { type: String },
      
      // Timestamps
      registeredAt: { type: Date },
      cancelledAt: { type: Date },
      checkedInAt: { type: Date },
      checkedOutAt: { type: Date },
      
      // How we matched this to a user
      matchedBy: { 
        type: String, 
        enum: ["email", "ky_id", "unmatched"] 
      },
      
      // Store raw webhook data for debugging
      rawPayload: { type: Schema.Types.Mixed },
    },
    
    // ═══════════════════════════════════════════════════════════════
    // MANUAL VERIFICATION FIELDS
    // Only populated for source="manual_*"
    // ═══════════════════════════════════════════════════════════════
    
    manualVerification: {
      // Payment proof
      transactionId: { type: String },          // UPI transaction ID, bank ref, etc.
      paymentScreenshotS3Key: { type: String }, // S3 key for payment screenshot
      paymentMethod: { 
        type: String, 
        enum: ["upi", "bank_transfer", "cash", "other"] 
      },
      paymentNote: { type: String },            // User's note about payment
      
      // Verification
      verifiedBy: { type: String },             // Admin user ID who verified
      verifiedAt: { type: Date },
      verificationNote: { type: String },       // Admin's note
      
      // Rejection (if rejected)
      rejectedBy: { type: String },
      rejectedAt: { type: Date },
      rejectionReason: { type: String },
    },
    
    // ═══════════════════════════════════════════════════════════════
    // COMPLIMENTARY PASS FIELDS
    // Only populated for source="complimentary"
    // ═══════════════════════════════════════════════════════════════
    
    complimentary: {
      reason: { type: String },                 // Why pass was given free
      approvedBy: { type: String },             // Admin who approved
      approvedAt: { type: Date },
    },
    
    // ═══════════════════════════════════════════════════════════════
    // EVENT CHECK-IN (for all sources)
    // ═══════════════════════════════════════════════════════════════
    
    checkIn: {
      checkedInAt: { type: Date },
      checkedInBy: { type: String },            // Admin/volunteer who checked in
      checkedOutAt: { type: Date },
      checkInLocation: { type: String },        // Entry gate, venue, etc.
    },
    
    // ═══════════════════════════════════════════════════════════════
    // USER INFO SNAPSHOT
    // Captured at time of purchase (in case user details change later)
    // ═══════════════════════════════════════════════════════════════
    
    userSnapshot: {
      email: { type: String },
      name: { type: String },
      phone: { type: String },
      kyId: { type: String },
      college: { type: String },
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// ═══════════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════════

// Common query patterns
PurchaseSchema.index({ userId: 1, status: 1 });
PurchaseSchema.index({ source: 1, status: 1 });
PurchaseSchema.index({ "userSnapshot.email": 1 });
PurchaseSchema.index({ "userSnapshot.kyId": 1 });
PurchaseSchema.index({ "manualVerification.transactionId": 1 });

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type PurchaseSchemaType = InferSchemaType<typeof PurchaseSchema> & {
  createdAt: Date;
  updatedAt: Date;
};

export type PurchaseDoc = HydratedDocument<PurchaseSchemaType>;

export const PurchaseModel = connInstance.getModel<PurchaseDoc>("Purchase", PurchaseSchema);
