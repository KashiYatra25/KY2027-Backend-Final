import { z } from "zod";

export const caApplicationApprovalRequestSchema = z.object({
  applicationId: z.string().min(1, "Application ID is required"),
  action: z.enum(["ACCEPTED", "REJECTED"]),
  rejectionReason: z.string().min(10, "Rejection reason must be at least 10 characters").optional(),
}).refine(
  (data) => {
    // If action is REJECTED, rejectionReason is required
    if (data.action === "REJECTED") {
      return !!data.rejectionReason;
    }
    return true;
  },
  {
    message: "Rejection reason is required when rejecting an application",
    path: ["rejectionReason"],
  }
);

export type CaApplicationApprovalRequestSchemaType = z.infer<typeof caApplicationApprovalRequestSchema>;
