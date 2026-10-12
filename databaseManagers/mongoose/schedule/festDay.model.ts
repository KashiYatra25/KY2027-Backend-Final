import { connInstance } from "../connection.js";
import { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

// ═══════════════════════════════════════════════════════════════════
// FEST DAY MODEL
// Festival day configuration (Day 1, Day 2, etc.)
// ═══════════════════════════════════════════════════════════════════

export const FestDaySchema = new Schema(
  {
    dayNumber: {
      type: Number,
      required: true,
      unique: true,
      min: 1,
      // e.g., 1, 2, 3, 4
    },
    date: {
      type: Date,
      required: true,
      // Actual date: 2027-01-14
    },
    displayDate: {
      type: String,
      required: true,
      // Short display format: "14 Jan"
    },
    name: {
      type: String,
      trim: true,
      // Optional theme name: "Opening Day", "Grand Finale"
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
FestDaySchema.index({ dayNumber: 1 });
FestDaySchema.index({ date: 1 });

export type FestDaySchemaType = InferSchemaType<typeof FestDaySchema> & {
  createdAt: Date;
  updatedAt: Date;
};

export type FestDayDoc = HydratedDocument<FestDaySchemaType>;

export const FestDayModel = connInstance.getModel<FestDayDoc>("FestDay", FestDaySchema);
