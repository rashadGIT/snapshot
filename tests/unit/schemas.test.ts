import { describe, it, expect } from 'vitest';
import {
  selectRoleSchema,
  createJobSchema,
  updateJobStatusSchema,
  validateStatusTransition,
  createMessageSchema,
  presignedUrlRequestSchema,
  recordUploadSchema,
  ratingSchema,
  joinJobSchema,
} from '@/lib/validation/schemas';
import { JobStatus, UserRole } from '@prisma/client';

/**
 * Validation Schemas Unit Tests
 * Tests Zod schema validation logic
 */

describe('Validation Schemas', () => {
  describe('selectRoleSchema', () => {
    it('should accept valid REQUESTER role', () => {
      const result = selectRoleSchema.safeParse({ role: 'REQUESTER' });
      expect(result.success).toBe(true);
    });

    it('should accept valid HELPER role', () => {
      const result = selectRoleSchema.safeParse({ role: 'HELPER' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid role', () => {
      const result = selectRoleSchema.safeParse({ role: 'INVALID' });
      expect(result.success).toBe(false);
    });

    it('should reject missing role', () => {
      const result = selectRoleSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('createJobSchema', () => {
    const validJob = {
      title: 'Wedding Photography',
      description: 'Need a photographer for my wedding ceremony',
      location: 'Central Park, NYC',
      eventTime: new Date().toISOString(),
      contentType: 'photos',
      priceTier: 'standard',
    };

    it('should accept valid job data', () => {
      const result = createJobSchema.safeParse(validJob);
      expect(result.success).toBe(true);
    });

    it('should reject title under 5 characters', () => {
      const result = createJobSchema.safeParse({
        ...validJob,
        title: 'Test',
      });
      expect(result.success).toBe(false);
    });

    it('should reject title over 100 characters', () => {
      const result = createJobSchema.safeParse({
        ...validJob,
        title: 'a'.repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it('should reject description under 10 characters', () => {
      const result = createJobSchema.safeParse({
        ...validJob,
        description: 'Short',
      });
      expect(result.success).toBe(false);
    });

    it('should reject description over 1000 characters', () => {
      const result = createJobSchema.safeParse({
        ...validJob,
        description: 'a'.repeat(1001),
      });
      expect(result.success).toBe(false);
    });

    it('should reject location under 3 characters', () => {
      const result = createJobSchema.safeParse({
        ...validJob,
        location: 'NY',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid eventTime format', () => {
      const result = createJobSchema.safeParse({
        ...validJob,
        eventTime: 'not-a-date',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid contentType', () => {
      const result = createJobSchema.safeParse({
        ...validJob,
        contentType: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('should accept photos contentType', () => {
      const result = createJobSchema.safeParse({
        ...validJob,
        contentType: 'photos',
      });
      expect(result.success).toBe(true);
    });

    it('should accept videos contentType', () => {
      const result = createJobSchema.safeParse({
        ...validJob,
        contentType: 'videos',
      });
      expect(result.success).toBe(true);
    });

    it('should accept both contentType', () => {
      const result = createJobSchema.safeParse({
        ...validJob,
        contentType: 'both',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid priceTier', () => {
      const result = createJobSchema.safeParse({
        ...validJob,
        priceTier: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('should accept optional notes field', () => {
      const result = createJobSchema.safeParse({
        ...validJob,
        notes: 'Additional instructions',
      });
      expect(result.success).toBe(true);
    });

    it('should accept missing notes field', () => {
      const result = createJobSchema.safeParse(validJob);
      expect(result.success).toBe(true);
    });

    it('should reject notes over 500 characters', () => {
      const result = createJobSchema.safeParse({
        ...validJob,
        notes: 'a'.repeat(501),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateJobStatusSchema', () => {
    it('should accept valid job status', () => {
      const result = updateJobStatusSchema.safeParse({ status: 'OPEN' });
      expect(result.success).toBe(true);
    });

    it('should accept all job statuses', () => {
      const statuses = ['OPEN', 'ACCEPTED', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED'];

      statuses.forEach(status => {
        const result = updateJobStatusSchema.safeParse({ status });
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid status', () => {
      const result = updateJobStatusSchema.safeParse({ status: 'INVALID' });
      expect(result.success).toBe(false);
    });
  });

  describe('validateStatusTransition', () => {
    it('should allow OPEN to ACCEPTED', () => {
      const result = validateStatusTransition(JobStatus.OPEN, JobStatus.ACCEPTED);
      expect(result.valid).toBe(true);
    });

    it('should allow OPEN to CANCELLED', () => {
      const result = validateStatusTransition(JobStatus.OPEN, JobStatus.CANCELLED);
      expect(result.valid).toBe(true);
    });

    it('should not allow OPEN to IN_PROGRESS', () => {
      const result = validateStatusTransition(JobStatus.OPEN, JobStatus.IN_PROGRESS);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot transition');
    });

    it('should allow ACCEPTED to IN_PROGRESS', () => {
      const result = validateStatusTransition(JobStatus.ACCEPTED, JobStatus.IN_PROGRESS);
      expect(result.valid).toBe(true);
    });

    it('should allow ACCEPTED to CANCELLED', () => {
      const result = validateStatusTransition(JobStatus.ACCEPTED, JobStatus.CANCELLED);
      expect(result.valid).toBe(true);
    });

    it('should allow IN_PROGRESS to IN_REVIEW', () => {
      const result = validateStatusTransition(JobStatus.IN_PROGRESS, JobStatus.IN_REVIEW);
      expect(result.valid).toBe(true);
    });

    it('should allow IN_PROGRESS to CANCELLED', () => {
      const result = validateStatusTransition(JobStatus.IN_PROGRESS, JobStatus.CANCELLED);
      expect(result.valid).toBe(true);
    });

    it('should allow IN_REVIEW to COMPLETED', () => {
      const result = validateStatusTransition(JobStatus.IN_REVIEW, JobStatus.COMPLETED);
      expect(result.valid).toBe(true);
    });

    it('should allow IN_REVIEW to CANCELLED', () => {
      const result = validateStatusTransition(JobStatus.IN_REVIEW, JobStatus.CANCELLED);
      expect(result.valid).toBe(true);
    });

    it('should not allow transitions from COMPLETED', () => {
      const result = validateStatusTransition(JobStatus.COMPLETED, JobStatus.OPEN);
      expect(result.valid).toBe(false);
    });

    it('should not allow transitions from CANCELLED', () => {
      const result = validateStatusTransition(JobStatus.CANCELLED, JobStatus.OPEN);
      expect(result.valid).toBe(false);
    });

    it('should not allow skipping states', () => {
      const result = validateStatusTransition(JobStatus.OPEN, JobStatus.COMPLETED);
      expect(result.valid).toBe(false);
    });

    it('should not allow backward transitions', () => {
      const result = validateStatusTransition(JobStatus.IN_PROGRESS, JobStatus.ACCEPTED);
      expect(result.valid).toBe(false);
    });
  });

  describe('createMessageSchema', () => {
    it('should accept valid message', () => {
      const result = createMessageSchema.safeParse({ content: 'Hello world' });
      expect(result.success).toBe(true);
    });

    it('should reject empty message', () => {
      const result = createMessageSchema.safeParse({ content: '' });
      expect(result.success).toBe(false);
    });

    it('should reject message over 1000 characters', () => {
      const result = createMessageSchema.safeParse({ content: 'a'.repeat(1001) });
      expect(result.success).toBe(false);
    });

    it('should accept message with exactly 1000 characters', () => {
      const result = createMessageSchema.safeParse({ content: 'a'.repeat(1000) });
      expect(result.success).toBe(true);
    });

    it('should accept single character message', () => {
      const result = createMessageSchema.safeParse({ content: 'a' });
      expect(result.success).toBe(true);
    });
  });

  describe('presignedUrlRequestSchema', () => {
    const validRequest = {
      jobId: '123e4567-e89b-12d3-a456-426614174000',
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
      fileSize: 5 * 1024 * 1024, // 5MB
    };

    it('should accept valid request', () => {
      const result = presignedUrlRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = presignedUrlRequestSchema.safeParse({
        ...validRequest,
        jobId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('should accept image content types', () => {
      const types = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

      types.forEach(contentType => {
        const result = presignedUrlRequestSchema.safeParse({
          ...validRequest,
          contentType,
        });
        expect(result.success).toBe(true);
      });
    });

    it('should accept video content types', () => {
      const types = ['video/mp4', 'video/webm', 'video/quicktime'];

      types.forEach(contentType => {
        const result = presignedUrlRequestSchema.safeParse({
          ...validRequest,
          contentType,
        });
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid content types', () => {
      const types = ['application/pdf', 'text/plain', 'audio/mp3'];

      types.forEach(contentType => {
        const result = presignedUrlRequestSchema.safeParse({
          ...validRequest,
          contentType,
        });
        expect(result.success).toBe(false);
      });
    });

    it('should reject file size over 100MB', () => {
      const result = presignedUrlRequestSchema.safeParse({
        ...validRequest,
        fileSize: 101 * 1024 * 1024,
      });
      expect(result.success).toBe(false);
    });

    it('should accept file size at exactly 100MB', () => {
      const result = presignedUrlRequestSchema.safeParse({
        ...validRequest,
        fileSize: 100 * 1024 * 1024,
      });
      expect(result.success).toBe(true);
    });

    it('should reject negative file size', () => {
      const result = presignedUrlRequestSchema.safeParse({
        ...validRequest,
        fileSize: -1024,
      });
      expect(result.success).toBe(false);
    });

    it('should reject zero file size', () => {
      const result = presignedUrlRequestSchema.safeParse({
        ...validRequest,
        fileSize: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty filename', () => {
      const result = presignedUrlRequestSchema.safeParse({
        ...validRequest,
        filename: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject filename over 255 characters', () => {
      const result = presignedUrlRequestSchema.safeParse({
        ...validRequest,
        filename: 'a'.repeat(256) + '.jpg',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('recordUploadSchema', () => {
    const validUpload = {
      s3Key: 'job-123/photo-456.jpg',
      s3Bucket: 'my-bucket',
      fileName: 'photo.jpg',
      fileType: 'image/jpeg',
      fileSize: 1024,
    };

    it('should accept valid upload data', () => {
      const result = recordUploadSchema.safeParse(validUpload);
      expect(result.success).toBe(true);
    });

    it('should accept optional thumbnailKey', () => {
      const result = recordUploadSchema.safeParse({
        ...validUpload,
        thumbnailKey: 'job-123/thumb-456.jpg',
      });
      expect(result.success).toBe(true);
    });

    it('should reject zero file size', () => {
      const result = recordUploadSchema.safeParse({
        ...validUpload,
        fileSize: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative file size', () => {
      const result = recordUploadSchema.safeParse({
        ...validUpload,
        fileSize: -1,
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty s3Key', () => {
      const result = recordUploadSchema.safeParse({
        ...validUpload,
        s3Key: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty fileName', () => {
      const result = recordUploadSchema.safeParse({
        ...validUpload,
        fileName: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ratingSchema', () => {
    it('should accept valid ratings 1-5', () => {
      [1, 2, 3, 4, 5].forEach(score => {
        const result = ratingSchema.safeParse({ score });
        expect(result.success).toBe(true);
      });
    });

    it('should reject rating below 1', () => {
      const result = ratingSchema.safeParse({ score: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject rating above 5', () => {
      const result = ratingSchema.safeParse({ score: 6 });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer ratings', () => {
      const result = ratingSchema.safeParse({ score: 3.5 });
      expect(result.success).toBe(false);
    });

    it('should accept optional comment', () => {
      const result = ratingSchema.safeParse({
        score: 5,
        comment: 'Great job!',
      });
      expect(result.success).toBe(true);
    });

    it('should reject comment over 500 characters', () => {
      const result = ratingSchema.safeParse({
        score: 5,
        comment: 'a'.repeat(501),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('joinJobSchema', () => {
    it('should accept valid token', () => {
      const result = joinJobSchema.safeParse({ token: 'abc123' });
      expect(result.success).toBe(true);
    });

    it('should reject empty token', () => {
      const result = joinJobSchema.safeParse({ token: '' });
      expect(result.success).toBe(false);
    });

    it('should reject missing token', () => {
      const result = joinJobSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept 6-digit short code', () => {
      const result = joinJobSchema.safeParse({ token: '123456' });
      expect(result.success).toBe(true);
    });

    it('should accept long token format', () => {
      const result = joinJobSchema.safeParse({
        token: 'randompart.hmacpart',
      });
      expect(result.success).toBe(true);
    });
  });
});
