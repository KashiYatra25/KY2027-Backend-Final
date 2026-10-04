import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

export type ContactSchemaType = z.infer<typeof contactSchema>;
