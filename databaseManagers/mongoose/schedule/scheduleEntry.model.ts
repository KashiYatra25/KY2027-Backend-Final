import { connInstance } from "../connection.js";
import { Schema, type HydratedDocument, type InferSchemaType, Types } from "mongoose";

// ═══════════════════════════════════════════════════════════════════
// SCHEDULE ENTRY MODEL
// Links events to venues and days - the actual schedule data
// ═══════════════════════════════════════════════════════════════════

/**
 * Event category slugs (matching Prisma Event.category enum)
 */
const EVENT_CATEGORIES = [
  "NATRAJ",
  "CROSSWINDZ",
  "BANDISH",
  "ABHINAY",
  "MIRAGE",
  "TOOLIKA",
  "ENQUIZTA",
  "SAMWAAD",
  "ZAIKA",
] as const;

export const ScheduleEntrySchema = new Schema(
  {
    // Reference to Prisma Event via its slug
    eventSlug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      // e.g., "nritya", "cut-a-rug", "sur"
    },
    // Category for quick filtering (denormalized for performance)
    categorySlug: {
      type: String,
      required: true,
      uppercase: true,
      enum: EVENT_CATEGORIES,
      // e.g., "NATRAJ", "CROSSWINDZ"
    },
    // Reference to Venue
    venueId: {
      type: Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
    },
    // Denormalized venue slug for quick lookups
    venueSlug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    // Day number (1-4)
    day: {
      type: Number,
      required: true,
      min: 1,
    },
    // Optional time range
    startTime: {
      type: String,
      // e.g., "10:00", "14:30"
    },
    endTime: {
      type: String,
      // e.g., "12:00", "17:00"
    },
    // Status
    active: {
      type: Boolean,
      default: true,
    },
    // Display order within same day/venue
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for common queries
ScheduleEntrySchema.index({ day: 1, active: 1 });
ScheduleEntrySchema.index({ venueSlug: 1, day: 1 });
ScheduleEntrySchema.index({ categorySlug: 1, day: 1 });
ScheduleEntrySchema.index({ eventSlug: 1 }, { unique: true }); // One schedule entry per event
ScheduleEntrySchema.index({ venueId: 1 });

export type ScheduleEntrySchemaType = InferSchemaType<typeof ScheduleEntrySchema> & {
  createdAt: Date;
  updatedAt: Date;
};

export type ScheduleEntryDoc = HydratedDocument<ScheduleEntrySchemaType>;

export const ScheduleEntryModel = connInstance.getModel<ScheduleEntryDoc>(
  "ScheduleEntry",
  ScheduleEntrySchema,
);
