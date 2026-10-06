import { connInstance } from "../connection.js";
import { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

/**
 * Event Registration Schema
 * 
 * Flexible structure to handle:
 * - Individual: userId only
 * - Duo/Team: teamId (references Team.teamId)
 * 
 * References Prisma Event.slug and User.id / Team.teamId
 */
export const EventRegistrationSchema = new Schema(
  {
    eventSlug: {
      type: String,
      required: true,
      index: true,
    },
    participationType: {
      type: String,
      enum: ["individual", "duo", "team"],
      required: true,
    },

    // For individual registration
    userId: {
      type: String,
      sparse: true,
    },

    // For duo/team registration (references Team.teamId)
    teamId: {
      type: String,
      sparse: true,
    },

    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "waitlisted"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes

// Prevent duplicate individual registrations (one user per event)
EventRegistrationSchema.index(
  { eventSlug: 1, userId: 1 },
  { unique: true, sparse: true }
);

// Prevent duplicate team registrations (one team per event)
EventRegistrationSchema.index(
  { eventSlug: 1, teamId: 1 },
  { unique: true, sparse: true }
);

// Find all registrations for a user or team
EventRegistrationSchema.index({ userId: 1 });
EventRegistrationSchema.index({ teamId: 1 });

// Filter by status
EventRegistrationSchema.index({ status: 1 });

export type EventRegistrationSchemaType = InferSchemaType<
  typeof EventRegistrationSchema
> & {
  createdAt: Date;
  updatedAt: Date;
};

export type EventRegistrationDoc = HydratedDocument<EventRegistrationSchemaType>;

export const EventRegistrationModel = connInstance.getModel<EventRegistrationDoc>(
  "EventRegistration",
  EventRegistrationSchema
);
