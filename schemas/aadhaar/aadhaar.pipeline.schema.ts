import { z } from "zod";

export const getAadhaarUploadUrlRequestSchema = z.object({
  fileType: z.string(),
});

export const confirmAadhaarUploadRequestSchema = z.object({
  s3Key: z.string(),
});

export type GetAadhaarUploadUrlRequestSchemaType = z.infer<typeof getAadhaarUploadUrlRequestSchema>;
export type ConfirmAadhaarUploadRequestSchemaType = z.infer<typeof confirmAadhaarUploadRequestSchema>;
