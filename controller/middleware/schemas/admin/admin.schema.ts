import { z } from 'zod';

const adminInviteSchema = z.object({
  targetEmail: z.email('Invalid email address'),
  role : z.enum(['MANAGER', 'OPERATOR'])
});

const adminCredVerificationSchema = z.object({
  adminPassword: z.string().min(8, 'Password must be at least 8 characters long'),
});

const adminSuspendSchema = z.object({
  targetEmail: z.email('Invalid email address'),
  reason: z.string().min(10, 'Reason must be at least 10 characters long').optional(),
  role: z.enum(['MANAGER', 'OPERATOR']).optional(), // Used for reactivation
});

type AdminInviteSchemaType = z.infer<typeof adminInviteSchema>;
type AdminCredVerificationSchemaType = z.infer<typeof adminCredVerificationSchema>;
type AdminSuspendSchemaType = z.infer<typeof adminSuspendSchema>;

export { adminInviteSchema, adminCredVerificationSchema, adminSuspendSchema };
export type { AdminInviteSchemaType, AdminCredVerificationSchemaType, AdminSuspendSchemaType };