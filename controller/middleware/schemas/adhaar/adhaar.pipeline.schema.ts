import { z } from 'zod';

export const adhaarUploadUrlSchema = z.object({
    fileType : z.string()
})

export const confirmAdhaarUploadSchema = z.object({
    s3Key : z.string()
})