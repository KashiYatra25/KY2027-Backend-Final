import { z } from "zod";

export const contactUsRequestSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

export type ContactUsRequestSchemaType = z.infer<typeof contactUsRequestSchema>;
