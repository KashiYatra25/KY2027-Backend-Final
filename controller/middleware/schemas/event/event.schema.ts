import { z } from "zod";

// Query params for listing events
export const getEventsQuerySchema = z.object({
  category: z
    .enum([
      "NATRAJ",
      "CROSSWINDZ",
      "BANDISH",
      "ABHINAY",
      "MIRAGE",
      "TOOLIKA",
      "ENQUIZTA",
      "SAMWAAD",
      "ZAIKA",
    ])
    .optional(),
  participationType: z.enum(["INDIVIDUAL", "DUO", "TEAM"]).optional(),
  registrationOpen: z
    .string()
    .transform((val) => val === "true")
    .optional(),
});

// Path param for single event
export const eventSlugParamSchema = z.object({
  slug: z.string().min(1, { message: "Event slug is required" }),
});

// Body for event registration - discriminated union
// Individual: type="individual", no teamId needed
// DUO/TEAM: type="team", requires teamId
export const registerIndividualSchema = z.object({
  type: z.literal("individual"),
});

export const registerTeamSchema = z.object({
  type: z.literal("team"),
  teamId: z.string().min(1, { message: "Team ID is required for team events" }),
});

export const registerForEventSchema = z.discriminatedUnion("type", [
  registerIndividualSchema,
  registerTeamSchema,
]);

export type GetEventsQueryType = z.infer<typeof getEventsQuerySchema>;
export type EventSlugParamType = z.infer<typeof eventSlugParamSchema>;
export type RegisterForEventType = z.infer<typeof registerForEventSchema>;
