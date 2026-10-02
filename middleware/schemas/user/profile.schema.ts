import { z } from "zod";

export const updateProfileSchema = z.object({
  college: z.string().min(2).max(200),
});

export type UpdateProfileSchemaType = z.infer<typeof updateProfileSchema>;
