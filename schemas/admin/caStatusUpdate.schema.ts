import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════
// CA APPLICATION STATUS UPDATE SCHEMA
//
// Used for PATCH /admin/ca/update-status
// Only allows ACCEPTED or REJECTED (NOT PENDING)
// This endpoint is for changing status of already-processed applications
// ═══════════════════════════════════════════════════════════════════

export const caApplicationStatusUpdateSchema = z.object({
  applicationId: z.string().min(1, "Application ID is required"),
  
  // Only ACCEPTED or REJECTED allowed - PENDING is NOT valid for updates
  newStatus: z.enum(["ACCEPTED", "REJECTED"]),
  
  // Reason is optional at schema level, but required for REJECTED (validated in refine)
  reason: z
    .string()
    .min(10, "Reason must be at least 10 characters")
    .max(500, "Reason cannot exceed 500 characters")
    .optional(),
}).refine(
  (data) => {
    // If newStatus is REJECTED, reason is required
    if (data.newStatus === "REJECTED") {
      return !!data.reason && data.reason.trim().length >= 10;
    }
    return true;
  },
  {
    message: "Reason is required when changing status to REJECTED (minimum 10 characters)",
    path: ["reason"],
  }
);

export type CaApplicationStatusUpdateSchemaType = z.infer<typeof caApplicationStatusUpdateSchema>;
