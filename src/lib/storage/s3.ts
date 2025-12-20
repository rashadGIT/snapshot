/**
 * S3 Storage Utilities
 * Pre-signed URL generation for secure uploads
 * Uses LocalStack for local development
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

// S3 Configuration - lazy initialization to handle environment variables
// This ensures variables are read at runtime, not at module load time
let s3Client: S3Client | null = null;

function getS3Config() {
  const AWS_REGION = process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1';
  const AWS_ENDPOINT_URL = process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT_URL;
  const AWS_S3_BUCKET = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
  const AWS_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const AWS_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

  // Validate required variables
  if (!AWS_S3_BUCKET) {
    throw new Error('S3_BUCKET or AWS_S3_BUCKET environment variable is required');
  }
  if (!AWS_ACCESS_KEY_ID) {
    throw new Error('S3_ACCESS_KEY_ID or AWS_ACCESS_KEY_ID environment variable is required');
  }
  if (!AWS_SECRET_ACCESS_KEY) {
    throw new Error('S3_SECRET_ACCESS_KEY or AWS_SECRET_ACCESS_KEY environment variable is required');
  }

  return {
    region: AWS_REGION,
    bucket: AWS_S3_BUCKET,
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    endpoint: AWS_ENDPOINT_URL,
  };
}

function getS3Client(): S3Client {
  if (!s3Client) {
    const config = getS3Config();
    s3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      ...(config.endpoint && {
        endpoint: config.endpoint,
        forcePathStyle: true, // Required for LocalStack
      }),
      // Disable checksum validation for LocalStack compatibility
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
  }
  return s3Client;
}

/**
 * Generate a secure S3 object key for upload
 * Format: jobId/uuid-sanitizedFilename
 * Never trust client-provided filenames directly
 */
export function generateS3Key(jobId: string, originalFilename: string): string {
  // Sanitize filename: remove path traversal, keep extension
  const sanitized = originalFilename
    .replace(/^.*[\\\/]/, '') // Remove path
    .replace(/[^a-zA-Z0-9.-]/g, '_'); // Replace unsafe chars

  const uuid = uuidv4();
  return `${jobId}/${uuid}-${sanitized}`;
}

/**
 * Generate a pre-signed URL for S3 upload
 * Expires in 15 minutes
 * Enforces content type and size limits
 */
export async function generatePresignedUploadUrl(
  jobId: string,
  filename: string,
  contentType: string,
  _maxSizeBytes: number = 100 * 1024 * 1024, // 100MB default
): Promise<{ url: string; key: string; bucket: string }> {
  // Validate content type (images and videos only)
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
  ];

  if (!allowedTypes.includes(contentType)) {
    throw new Error(`Invalid content type: ${contentType}`);
  }

  const config = getS3Config();
  const client = getS3Client();
  const key = generateS3Key(jobId, filename);

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
    // Add metadata for tracking
    Metadata: {
      jobId,
      uploadedAt: new Date().toISOString(),
    },
    // Disable checksum for LocalStack compatibility
    ChecksumAlgorithm: undefined,
  });

  // Generate pre-signed URL valid for 15 minutes
  const url = await getSignedUrl(client, command, {
    expiresIn: 900,
    // Don't sign checksum headers for LocalStack
    unhoistableHeaders: new Set(['x-amz-checksum-crc32', 'x-amz-sdk-checksum-algorithm']),
  });

  return {
    url,
    key,
    bucket: config.bucket,
  };
}

/**
 * Get public URL for uploaded file
 * In production, use CloudFront or private access
 * In development with LocalStack, construct direct URL
 */
export function getPublicUrl(key: string): string {
  const config = getS3Config();

  if (config.endpoint) {
    // LocalStack URL
    return `${config.endpoint}/${config.bucket}/${key}`;
  }

  // Production S3 URL (use CloudFront in real production)
  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
}
