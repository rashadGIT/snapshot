/**
 * Video Conversion Utility
 *
 * Converts WebM videos to MP4 format for Safari/iOS compatibility.
 * Uses FFmpeg with optimized settings for web streaming.
 */

import ffmpeg from 'fluent-ffmpeg';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { getS3Client } from '../storage/s3';
import { logger } from '../utils/logger';

/**
 * Progress callback interface
 */
export interface ConversionProgress {
  percent: number;
  currentTime: string;
  targetSize: string;
}

/**
 * Conversion options
 */
export interface ConversionOptions {
  inputStream: Readable;
  onProgress?: (progress: ConversionProgress) => void;
  timeout?: number; // Maximum conversion time in milliseconds (default: 5 minutes)
}

/**
 * Conversion result
 */
export interface ConversionResult {
  buffer: Buffer;
  size: number;
  duration?: number;
}

/**
 * Generate S3 key for converted file
 * Original: jobId/uuid-filename.webm
 * Converted: jobId/uuid-filename-converted.mp4
 */
export function generateConvertedS3Key(originalKey: string): string {
  return originalKey.replace(/\.webm$/i, '-converted.mp4');
}

/**
 * Convert WebM video to MP4 format
 * Uses H.264 video codec and AAC audio codec for Safari/iOS compatibility
 */
export async function convertWebmToMp4(
  options: ConversionOptions
): Promise<ConversionResult> {
  const { inputStream, onProgress, timeout = 300000 } = options;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let timedOut = false;

    // Set timeout
    const timeoutId = setTimeout(() => {
      timedOut = true;
      reject(new Error(`Conversion timeout after ${timeout}ms`));
    }, timeout);

    try {
      ffmpeg(inputStream)
        .outputFormat('mp4')
        .videoCodec('libx264') // H.264 for Safari/iOS
        .audioCodec('aac')     // AAC for Safari/iOS
        .outputOptions([
          '-movflags +faststart',  // Metadata at start for streaming
          '-preset medium',        // Balance speed/quality
          '-crf 23',              // Constant quality (18-28 range, 23 is good)
        ])
        .on('start', (commandLine) => {
          logger.debug('[Conversion] FFmpeg started:', commandLine);
        })
        .on('progress', (progress) => {
          if (!timedOut && onProgress) {
            onProgress({
              percent: progress.percent || 0,
              currentTime: String(progress.timemark || '00:00:00'),
              targetSize: String(progress.targetSize || '0kB'),
            });
          }
        })
        .on('end', () => {
          clearTimeout(timeoutId);
          if (!timedOut) {
            const buffer = Buffer.concat(chunks);
            logger.debug('[Conversion] FFmpeg completed:', {
              size: buffer.length,
              sizeMB: (buffer.length / 1024 / 1024).toFixed(2),
            });
            resolve({
              buffer,
              size: buffer.length,
            });
          }
        })
        .on('error', (err, stdout, stderr) => {
          clearTimeout(timeoutId);
          if (!timedOut) {
            logger.error('[Conversion] FFmpeg error:', {
              error: err.message,
              stderr: stderr?.substring(0, 500), // Log first 500 chars
            });
            reject(new Error(`FFmpeg conversion failed: ${err.message}`));
          }
        })
        .pipe()
        .on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
    } catch (error) {
      clearTimeout(timeoutId);
      logger.error('[Conversion] Setup error:', error);
      reject(error);
    }
  });
}

/**
 * Download file from S3 as a stream
 */
export async function downloadFromS3(
  bucket: string,
  key: string
): Promise<Readable> {
  const s3Client = getS3Client();

  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error('S3 response body is empty');
    }

    const stream = response.Body as Readable;
    logger.debug('[S3 Download] Started:', { bucket, key });

    return stream;
  } catch (error) {
    logger.error('[S3 Download] Failed:', { bucket, key, error });
    throw new Error(`Failed to download from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload file to S3
 */
export async function uploadToS3(
  bucket: string,
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const s3Client = getS3Client();

  try {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: {
        convertedFrom: 'video/webm',
        convertedAt: new Date().toISOString(),
      },
    });

    await s3Client.send(command);

    logger.debug('[S3 Upload] Completed:', {
      bucket,
      key,
      size: buffer.length,
      contentType,
    });
  } catch (error) {
    logger.error('[S3 Upload] Failed:', { bucket, key, error });
    throw new Error(`Failed to upload to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert a WebM video upload to MP4
 * Downloads from S3, converts, and uploads the result
 */
export interface UploadConversionInput {
  uploadId: string;
  s3Bucket: string;
  s3Key: string;
  fileName: string;
  onProgress?: (progress: ConversionProgress) => void;
}

export interface UploadConversionResult {
  convertedS3Key: string;
  convertedFileSize: number;
}

export async function convertUpload(
  input: UploadConversionInput
): Promise<UploadConversionResult> {
  const { uploadId, s3Bucket, s3Key, fileName, onProgress } = input;

  logger.info('[Convert Upload] Starting:', { uploadId, fileName });

  try {
    // 1. Download WebM from S3
    const webmStream = await downloadFromS3(s3Bucket, s3Key);

    // 2. Convert to MP4
    const result = await convertWebmToMp4({
      inputStream: webmStream,
      onProgress,
    });

    // 3. Generate converted S3 key
    const convertedS3Key = generateConvertedS3Key(s3Key);

    // 4. Upload MP4 to S3
    await uploadToS3(s3Bucket, convertedS3Key, result.buffer, 'video/mp4');

    logger.info('[Convert Upload] Completed:', {
      uploadId,
      originalSize: 'unknown',
      convertedSize: result.size,
      convertedKey: convertedS3Key,
    });

    return {
      convertedS3Key,
      convertedFileSize: result.size,
    };
  } catch (error) {
    logger.error('[Convert Upload] Failed:', {
      uploadId,
      fileName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
