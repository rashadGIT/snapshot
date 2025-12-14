/**
 * Zod Validation Schemas
 * Input validation for API requests and forms
 */

import { z } from 'zod';
import { JobStatus, UserRole } from '@prisma/client';

/**
 * User role selection during onboarding
 */
export const selectRoleSchema = z.object({
  role: z.enum([UserRole.REQUESTER, UserRole.HELPER]),
});

/**
 * Create job request
 */
export const createJobSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(100),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000),
  location: z.string().min(3, 'Location is required').max(200),
  eventTime: z.string().datetime('Invalid date/time format'),
  contentType: z.enum(['photos', 'videos', 'both']),
  notes: z.string().max(500).optional(),
  priceTier: z.enum(['basic', 'standard', 'premium']),
});

/**
 * Update job status
 */
export const updateJobStatusSchema = z.object({
  status: z.nativeEnum(JobStatus),
});

/**
 * Job status transitions validation
 * Enforces valid state machine transitions
 */
export function validateStatusTransition(
  currentStatus: JobStatus,
  newStatus: JobStatus,
): { valid: boolean; error?: string } {
  const validTransitions: Record<JobStatus, JobStatus[]> = {
    [JobStatus.OPEN]: [JobStatus.ACCEPTED, JobStatus.CANCELLED],
    [JobStatus.ACCEPTED]: [JobStatus.IN_PROGRESS, JobStatus.CANCELLED],
    [JobStatus.IN_PROGRESS]: [JobStatus.UPLOADED, JobStatus.CANCELLED],
    [JobStatus.UPLOADED]: [JobStatus.COMPLETED, JobStatus.CANCELLED],
    [JobStatus.COMPLETED]: [], // Terminal state
    [JobStatus.CANCELLED]: [], // Terminal state
  };

  const allowed = validTransitions[currentStatus];

  if (!allowed.includes(newStatus)) {
    return {
      valid: false,
      error: `Cannot transition from ${currentStatus} to ${newStatus}`,
    };
  }

  return { valid: true };
}

/**
 * Create message request
 */
export const createMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(1000),
});

/**
 * Request pre-signed upload URL
 */
export const presignedUrlRequestSchema = z.object({
  jobId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  contentType: z.string().regex(/^(image|video)\/.+$/, 'Invalid content type'),
  fileSize: z.number().int().positive().max(100 * 1024 * 1024), // 100MB max
});

/**
 * Record completed upload
 */
export const recordUploadSchema = z.object({
  s3Key: z.string().min(1),
  s3Bucket: z.string().min(1),
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1),
  fileSize: z.number().int().positive(),
});

/**
 * Submit rating
 */
export const ratingSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

/**
 * Join job via QR token
 */
export const joinJobSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});
