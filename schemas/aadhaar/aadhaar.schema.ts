import { z } from "zod";

export const getAadhaarUploadUrlRequestSchema = z.object({
  fileType: z.enum(["image/jpeg", "image/png", "image/jpg"], {
    message: "fileType must be one of image/jpeg, image/png, image/jpg",
  }),
});

export const confirmAadhaarUploadRequestSchema = z.object({
  s3Key: z
    .string()
    .min(1, "s3Key is required")
    .max(512, "s3Key too long")
    .regex(
      /^[a-zA-Z0-9!_.*'()/-]+\.(jpe?g|png)$/,
      "s3Key must be a valid S3 object key ending in .jpg, .jpeg, or .png",
    ),
});

export type GetAadhaarUploadUrlRequestSchemaType = z.infer<typeof getAadhaarUploadUrlRequestSchema>;
export type ConfirmAadhaarUploadRequestSchemaType = z.infer<typeof confirmAadhaarUploadRequestSchema>;
