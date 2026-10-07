import { z } from "zod";

export const searchUsersQuerySchema = z.object({
  q: z
    .string()
    .min(2, { message: "Search query must be at least 2 characters" })
    .max(50, { message: "Search query too long" }),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().min(1).max(20))
    .optional(),
});

export type SearchUsersQueryType = z.infer<typeof searchUsersQuerySchema>;
