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
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
});

// Path param for single event
export const eventSlugParamRequestSchema = z.object({
  slug: z.string().min(1, { message: "Event slug is required" }),
});

// Body for event registration - discriminated union
// Individual: type="individual", no teamId needed
// DUO/TEAM: type="team", requires teamId
export const registerIndividualToAnEventRequestSchema = z.object({
  type: z.literal("individual"),
});

export const registerTeamToAnEventRequestSchema = z.object({
  type: z.literal("team"),
  teamId: z.string().min(1, { message: "Team ID is required for team events" }),
});

export const registerForEventRequestSchema = z.discriminatedUnion("type", [
  registerIndividualToAnEventRequestSchema,
  registerTeamToAnEventRequestSchema,
]);

export type EventSlugParamRequestSchemaType = z.infer<typeof eventSlugParamRequestSchema>;
export type RegisterForEventRequestSchemaType = z.infer<typeof registerForEventRequestSchema>;
export type GetEventsQueryType = z.infer<typeof getEventsQuerySchema>;
