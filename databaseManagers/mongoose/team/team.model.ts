import { connInstance } from "@lib/mongo/connection.js";
import { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

/**
 * Team Member subdocument schema
 * Embedded within Team document
 */
const TeamMemberSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }  // no separate _id for subdocuments
);

/**
 * Team Schema
 * 
 * Standalone team entity (not tied to any event).
 * Can be used to register for multiple events.
 * All members must accept for team to be valid.
 */
export const TeamSchema = new Schema(
  {
    teamId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      unique: true,
    },
    createdBy: {
      type: String,      // Prisma User.id
      required: true,
    },
    members: {
      type: [TeamMemberSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
// teamId and name already have unique: true in schema which creates indexes
TeamSchema.index({ createdBy: 1 });
TeamSchema.index({ "members.userId": 1 });  // find teams by member

export type TeamSchemaType = InferSchemaType<typeof TeamSchema> & {
  createdAt: Date;
  updatedAt: Date;
};

export type TeamDoc = HydratedDocument<TeamSchemaType>;

export const TeamModel = connInstance.getModel<TeamDoc>("Team", TeamSchema);
