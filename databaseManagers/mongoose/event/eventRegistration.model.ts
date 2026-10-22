import { connInstance } from "@lib/mongo/connection.js";
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

// Prevent duplicate individual registrations (one user per event).
//
// A partial index (not a plain sparse index) is used so the uniqueness
// constraint only applies to documents that actually carry a `userId`.
// With a plain `sparse` compound index, team registrations (which have no
// `userId`) would still be indexed with `userId: null` and collide with each
// other on `eventSlug + null`, incorrectly allowing only a single team per
// event. The partial filter scopes the constraint strictly to individual
// registrations, making this index a reliable source of truth for
// duplicate-registration races.
EventRegistrationSchema.index(
  { eventSlug: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { userId: { $exists: true } },
  }
);

// Prevent duplicate team registrations (one team per event). Same partial
// index reasoning as above, scoped to documents that carry a `teamId`.
EventRegistrationSchema.index(
  { eventSlug: 1, teamId: 1 },
  {
    unique: true,
    partialFilterExpression: { teamId: { $exists: true } },
  }
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

// ── Cache invalidation on create / status change ──
import { invalidateRegistrationCacheHook } from "./hooks/invalidateRegistrationCache.hook.js";

EventRegistrationSchema.post("save", async function (doc: EventRegistrationDoc) {
  await invalidateRegistrationCacheHook(doc);
});

export const EventRegistrationModel = connInstance.getModel<EventRegistrationDoc>(
  "EventRegistration",
  EventRegistrationSchema
);
