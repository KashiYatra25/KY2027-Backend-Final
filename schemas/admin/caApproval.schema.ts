import { z } from "zod";

export const caApplicationApprovalRequestSchema = z.object({
  applicationId: z.string().min(1, "Application ID is required"),
  action: z.enum(["ACCEPTED", "REJECTED"]),
});

export type CaApplicationApprovalRequestSchemaType = z.infer<typeof caApplicationApprovalRequestSchema>;
