import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import type {
  R2PresignedUploadUrl,
  R2PresignedDownloadUrl,
  R2UploadOptions,
  BatchPresignRequest,
  BatchPresignResponse,
} from "./types.js";

// ═══════════════════════════════════════════════════════════════════
// R2 MANAGER
// 
// Cloudflare R2 storage manager using S3-compatible API.
// Used for storing payment proofs, bonafides, and other user uploads.
// ═══════════════════════════════════════════════════════════════════

export class R2Manager {
  private client: S3Client;
  private bucket: string;
  private publicUrl?: string;

  /**
   * Create R2 manager instance
   * @param accountId - Cloudflare Account ID
   * @param accessKeyId - R2 Access Key ID
   * @param secretAccessKey - R2 Secret Access Key
   * @param bucket - R2 bucket name
   * @param publicUrl - Optional public URL for the bucket (if public access enabled)
   */
  public constructor(
    accountId: string,
    accessKeyId: string,
    secretAccessKey: string,
    bucket: string,
    publicUrl?: string,
  ) {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    this.bucket = bucket;
    this.publicUrl = publicUrl;
  }

  /**
   * Generate a unique R2 key for file upload
   * @param identifier - Unique identifier (admin ID, request ID, etc.)
   * @param folder - Folder name (e.g., "bonafides")
   * @param extension - File extension (e.g., "jpg", "pdf")
   * @returns R2 key path
   */
  private generateKey(
    identifier: string,
    folder: string,
    extension: string,
  ): string {
    const uuid = crypto.randomUUID();
    const timestamp = Date.now();
    return `${folder}/${identifier}/${timestamp}-${uuid}.${extension}`;
  }

  /**
   * Get file extension from content type
   */
  private getExtensionFromContentType(contentType: string): string {
    const map: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "application/pdf": "pdf",
    };
    return map[contentType] || contentType.split("/")[1] || "bin";
  }

  /**
   * Generate pre-signed URL for uploading a file
   * @param options - Upload options (identifier, contentType, folder)
   * @param expiresIn - URL expiry in seconds (default: 300 = 5 mins)
   * @returns Pre-signed upload URL and R2 key
   */
  public async generateUploadUrl(
    options: R2UploadOptions,
    expiresIn: number = 300,
  ): Promise<R2PresignedUploadUrl> {
    const { identifier, contentType, folder, originalFilename } = options;
    const extension = this.getExtensionFromContentType(contentType);
    const key = this.generateKey(identifier, folder, extension);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      Metadata: {
        identifier,
        originalFilename: originalFilename || "",
        uploadedAt: new Date().toISOString(),
      },
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return { uploadUrl, key, expiresAt };
  }

  /**
   * Generate pre-signed URLs for multiple files (batch)
   * @param request - Batch request with files info
   * @param expiresIn - URL expiry in seconds (default: 300 = 5 mins)
   * @returns Array of pre-signed upload URLs
   */
  public async generateBatchUploadUrls(
    request: BatchPresignRequest,
    expiresIn: number = 300,
  ): Promise<BatchPresignResponse> {
    const { files, folder, identifier } = request;

    const uploads = await Promise.all(
      files.map(async (file) => {
        const { uploadUrl, key, expiresAt } = await this.generateUploadUrl(
          {
            identifier,
            contentType: file.contentType,
            folder,
            originalFilename: file.filename,
          },
          expiresIn,
        );

        return {
          filename: file.filename,
          uploadUrl,
          key,
          expiresAt,
        };
      }),
    );

    return { uploads };
  }

  /**
   * Generate pre-signed URL for downloading/viewing a file
   * @param key - R2 object key
   * @param expiresIn - URL expiry in seconds (default: 3600 = 1 hour)
   * @returns Pre-signed download URL
   */
  public async generateDownloadUrl(
    key: string,
    expiresIn: number = 3600,
  ): Promise<R2PresignedDownloadUrl> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const downloadUrl = await getSignedUrl(this.client, command, { expiresIn });
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return { downloadUrl, expiresAt };
  }

  /**
   * Get public URL for a file (if bucket has public access)
   * @param key - R2 object key
   * @returns Public URL or null if no public URL configured
   */
  public getPublicUrl(key: string): string | null {
    if (!this.publicUrl) return null;
    return `${this.publicUrl}/${key}`;
  }

  /**
   * Delete a file from R2
   * @param key - R2 object key to delete
   */
  public async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  /**
   * Delete multiple files from R2
   * @param keys - Array of R2 object keys to delete
   */
  public async deleteObjects(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.deleteObject(key)));
  }
}
