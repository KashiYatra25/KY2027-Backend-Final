/**
 * Pre-signed URL response for upload
 */
export interface PresignedUploadUrl {
  uploadUrl: string;
  s3Key: string;
  expiresAt: Date;
}

/**
 * Pre-signed URL response for download/view
 */
export interface PresignedDownloadUrl {
  downloadUrl: string;
  expiresAt: Date;
}

/**
 * S3 upload options
 */
export interface S3UploadOptions {
  userId: string;
  fileType: "image/jpeg" | "image/png" | "image/jpg";
  folder?: string;
}
