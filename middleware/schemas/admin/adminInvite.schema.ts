import { z } from 'zod';

export const adminInviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

export type AdminInviteSchemaType = z.infer<typeof adminInviteSchema>;
