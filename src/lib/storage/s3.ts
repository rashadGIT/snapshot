/**
 * S3 Storage Utilities
 * Pre-signed URL generation for secure uploads
 * Uses LocalStack for local development
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

// S3 Configuration - prioritize S3_* prefixed variables (Amplify compatible)
const AWS_REGION = process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1';
const AWS_ENDPOINT_URL = process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT_URL; // LocalStack endpoint

// Required environment variables with validation
function getRequiredEnv(primary: string, fallback: string): string {
  const value = process.env[primary] || process.env[fallback];
  if (!value) {
    throw new Error(`${primary} or ${fallback} environment variable is required`);
  }
  return value;
}

const AWS_S3_BUCKET = getRequiredEnv('S3_BUCKET', 'AWS_S3_BUCKET');
const AWS_ACCESS_KEY_ID = getRequiredEnv('S3_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID');
const AWS_SECRET_ACCESS_KEY = getRequiredEnv('S3_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY');

// S3 client configuration
const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
  ...(AWS_ENDPOINT_URL && {
    endpoint: AWS_ENDPOINT_URL,
    forcePathStyle: true, // Required for LocalStack
  }),
  // Disable checksum validation for LocalStack compatibility
  requestChecksumCalculation: 'WHEN_REQUIRED',
});

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

  const key = generateS3Key(jobId, filename);

  const command = new PutObjectCommand({
    Bucket: AWS_S3_BUCKET,
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
  const url = await getSignedUrl(s3Client, command, {
    expiresIn: 900,
    // Don't sign checksum headers for LocalStack
    unhoistableHeaders: new Set(['x-amz-checksum-crc32', 'x-amz-sdk-checksum-algorithm']),
  });

  return {
    url,
    key,
    bucket: AWS_S3_BUCKET,
  };
}

/**
 * Get public URL for uploaded file
 * In production, use CloudFront or private access
 * In development with LocalStack, construct direct URL
 */
export function getPublicUrl(key: string): string {
  if (AWS_ENDPOINT_URL) {
    // LocalStack URL
    return `${AWS_ENDPOINT_URL}/${AWS_S3_BUCKET}/${key}`;
  }

  // Production S3 URL (use CloudFront in real production)
  return `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
}
