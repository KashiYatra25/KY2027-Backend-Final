import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import type {
  PresignedUploadUrl,
  PresignedDownloadUrl,
  S3UploadOptions,
} from "./types.js";

export class S3Manager {
  private client: S3Client;
  private bucket: string;

  /**
   * Create S3 manager instance
   * @param region - AWS region (e.g., env.AWS_REGION)
   * @param bucket - S3 bucket name (e.g., env.S3_BUCKET)
   * @example
   * ```ts
   * const s3 = new S3Manager(env.AWS_REGION, env.S3_BUCKET);
   * ```
   */
  public constructor(region: string, bucket: string) {
    this.client = new S3Client({ region });
    this.bucket = bucket;
  }

  /**
   * Generate a unique S3 key for file upload
   * @param userId - User ID
   * @param folder - Folder name (e.g., "aadhaar")
   * @param extension - File extension (e.g., "jpg")
   * @returns S3 key path
   * @example
   * ```ts
   * generateS3Key("user_123", "aadhaar", "jpg")
   * // "aadhaar/user_123/550e8400-e29b-41d4-a716-446655440000.jpg"
   * ```
   */
  private generateS3Key(
    userId: string,
    folder: string,
    extension: string,
  ): string {
    const uuid = crypto.randomUUID();
    return `${folder}/${userId}/${uuid}.${extension}`;
  }

  /**
   * Generate pre-signed URL for uploading a file
   * @param options - Upload options (userId, fileType, folder)
   * @param expiresIn - URL expiry in seconds (default: 300 = 5 mins)
   * @returns Pre-signed upload URL and S3 key
   * @example
   * ```ts
   * const { uploadUrl, s3Key, expiresAt } = await s3.generateUploadUrl({
   *   userId: "user_123",
   *   fileType: "image/jpeg",
   *   folder: "aadhaar"
   * });
   * // Frontend uses uploadUrl to PUT the file directly to S3
   * ```
   */
  public async generateUploadUrl(
    options: S3UploadOptions,
    expiresIn: number = 300,
  ): Promise<PresignedUploadUrl> {
    const { userId, fileType, folder = "uploads" } = options;
    const extension = fileType.split("/")[1] ?? "jpg";
    const s3Key = this.generateS3Key(userId, folder, extension);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      ContentType: fileType,
      Metadata: {
        userId,
        uploadedAt: new Date().toISOString(),
      },
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return { uploadUrl, s3Key, expiresAt };
  }

  /**
   * Generate pre-signed URL for downloading/viewing a file
   * @param s3Key - S3 object key
   * @param expiresIn - URL expiry in seconds (default: 300 = 5 mins)
   * @returns Pre-signed download URL
   * @example
   * ```ts
   * const { downloadUrl } = await s3.generateDownloadUrl(
   *   "aadhaar/user_123/abc.jpg",
   *   600 // 10 mins
   * );
   * ```
   */
  public async generateDownloadUrl(
    s3Key: string,
    expiresIn: number = 300,
  ): Promise<PresignedDownloadUrl> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
    });

    const downloadUrl = await getSignedUrl(this.client, command, { expiresIn });
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return { downloadUrl, expiresAt };
  }

  /**
   * Delete a file from S3
   * @param s3Key - S3 object key to delete
   * @example
   * ```ts
   * await s3.deleteObject("aadhaar/user_123/abc.jpg");
   * ```
   */
  public async deleteObject(s3Key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
    });

    await this.client.send(command);
  }
}
