import { z } from 'zod';

export const aadhaarUploadUrlSchema = z.object({
    fileType: z.string()
});

export type AadhaarUploadUrlSchemaType = z.infer<typeof aadhaarUploadUrlSchema>;

export const confirmAadhaarUploadSchema = z.object({
    s3Key: z.string()
});

export type ConfirmAadhaarUploadSchemaType = z.infer<typeof confirmAadhaarUploadSchema>;
