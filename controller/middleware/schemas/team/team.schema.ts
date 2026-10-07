import { z } from "zod";

// Create team with members (no invites - direct add)
export const createTeamSchema = z.object({
  name: z
    .string()
    .min(3, { message: "Team name must be at least 3 characters" })
    .max(50, { message: "Team name too long" })
    .regex(/^[a-zA-Z0-9\s_-]+$/, {
      message: "Team name can only contain letters, numbers, spaces, hyphens and underscores",
    }),
  members: z
    .array(z.uuid({ message: "Invalid member ID" }))
    .min(1, { message: "Team must have at least 1 other member" })
    .max(9, { message: "Team can have at most 10 members including you" }),
});

export type CreateTeamType = z.infer<typeof createTeamSchema>;
