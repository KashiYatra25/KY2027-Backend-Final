import { connInstance } from "../connection.js";
import { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

// ═══════════════════════════════════════════════════════════════════
// VENUE MODEL
// Physical venues on the campus map where events take place
// ═══════════════════════════════════════════════════════════════════

/**
 * Label tone variants from the map design
 * - blue: Lecture theatres, halls
 * - red: Important buildings (Main Building, Temple)
 * - green: Outdoor grounds
 * - white: Gates, crossings
 * - text: Non-clickable direction signs
 */
const LABEL_TONES = ["blue", "red", "green", "white", "text"] as const;

export const VenueSchema = new Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      // e.g., "sb", "lt-1", "gymkhana-ground"
    },
    name: {
      type: String,
      required: true,
      trim: true,
      // Full name: "Swatantrata Bhawan"
    },
    label: {
      type: String,
      required: true,
      // Text shown on map label (may contain \n for line breaks)
      // e.g., "SB" or "GYMKHANA GROUND"
    },
    tone: {
      type: String,
      enum: LABEL_TONES,
      default: "blue",
      // Color variant for the label
    },
    large: {
      type: Boolean,
      default: false,
      // Whether to use larger label styling
    },
    // Position as percentage of map image (0-100)
    x: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    y: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    // Anchor point for leader line (where it points to on the map)
    anchorX: {
      type: Number,
      min: 0,
      max: 100,
    },
    anchorY: {
      type: Number,
      min: 0,
      max: 100,
    },
    clickable: {
      type: Boolean,
      default: true,
      // Direction signs etc. are drawn but not clickable
    },
    active: {
      type: Boolean,
      default: true,
      // Whether venue is shown on the map
    },
    sortOrder: {
      type: Number,
      default: 0,
      // Display order for lists
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
VenueSchema.index({ active: 1, sortOrder: 1 });
VenueSchema.index({ clickable: 1 });

export type VenueSchemaType = InferSchemaType<typeof VenueSchema> & {
  createdAt: Date;
  updatedAt: Date;
};

export type VenueDoc = HydratedDocument<VenueSchemaType>;

export const VenueModel = connInstance.getModel<VenueDoc>("Venue", VenueSchema);
