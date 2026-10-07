import { z } from "zod";

export const caApprovalSchema = z.object({
  applicationId: z.string().min(1, "Application ID is required"),
  action: z.enum(["ACCEPTED", "REJECTED"]),
});

export type CaApprovalSchemaType = z.infer<typeof caApprovalSchema>;
