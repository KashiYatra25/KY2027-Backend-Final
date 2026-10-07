import { connInstance } from "../connection.js";
import { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

// ═══════════════════════════════════════════════════════════════════
// PASS MODEL
// Festival passes with pricing, benefits, and details
// ═══════════════════════════════════════════════════════════════════

const PassBenefitSchema = new Schema(
  {
    text: {
      type: String,
      required: true,
    },
    highlight: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const PassDetailSchema = new Schema(
  {
    icon: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

export const PassSchema = new Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true, // e.g., "yatri", "darbar", "swarnim"
    },
    name: {
      type: String,
      required: true, // Display name: "Yatri Pass"
    },
    price: {
      type: Number,
      required: true, // Price in INR (e.g., 2399)
    },
    image: {
      type: String,
      required: true, // ImageKit URL for pass image
    },
    tagline: {
      type: String,
      required: true, // e.g., "Begin Your Journey"
    },
    accentColor: {
      type: String,
      required: true, // Hex color (e.g., "#1A5F7A")
    },
    glowColor: {
      type: String,
      required: true, // RGBA for glow (e.g., "rgba(26, 95, 122, 0.5)")
    },
    popular: {
      type: Boolean,
      default: false, // Highlight as recommended
    },
    active: {
      type: Boolean,
      default: true, // Whether pass is currently available
    },
    sortOrder: {
      type: Number,
      default: 0, // Display order (lower = first)
    },
    benefits: {
      type: [PassBenefitSchema],
      default: [],
    },
    details: {
      type: [PassDetailSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

PassSchema.index({ slug: 1 });
PassSchema.index({ active: 1, sortOrder: 1 });

export type PassSchemaType = InferSchemaType<typeof PassSchema> & {
  createdAt: Date;
  updatedAt: Date;
};

export type PassDoc = HydratedDocument<PassSchemaType>;

export const PassModel = connInstance.getModel<PassDoc>("Pass", PassSchema);
