/**
 * Pre-signed URL response for upload
 */
export interface R2PresignedUploadUrl {
  uploadUrl: string;
  key: string;
  expiresAt: Date;
}

/**
 * Pre-signed URL response for download/view
 */
export interface R2PresignedDownloadUrl {
  downloadUrl: string;
  expiresAt: Date;
}

/**
 * R2 upload options
 */
export interface R2UploadOptions {
  /** Unique identifier (e.g., admin ID or request ID) */
  identifier: string;
  /** File MIME type */
  contentType: string;
  /** Folder/prefix in bucket (e.g., "bonafides", "payment-proofs") */
  folder: string;
  /** Original filename (optional, for metadata) */
  originalFilename?: string;
}

/**
 * Batch presigned URL request
 */
export interface BatchPresignRequest {
  files: Array<{
    filename: string;
    contentType: string;
  }>;
  folder: string;
  identifier: string;
}

/**
 * Batch presigned URL response
 */
export interface BatchPresignResponse {
  uploads: Array<{
    filename: string;
    uploadUrl: string;
    key: string;
    expiresAt: Date;
  }>;
}
