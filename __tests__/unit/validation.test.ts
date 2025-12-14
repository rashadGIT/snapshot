/**
 * Unit Tests: Validation Schemas
 * Tests Zod schema validation logic
 */

import {
  createJobSchema,
  ratingSchema,
  presignedUrlRequestSchema,
  joinJobSchema,
} from '@/lib/validation/schemas';

describe('Validation Schemas', () => {
  describe('createJobSchema', () => {
    it('should validate a valid job', () => {
      const validJob = {
        title: 'Test Fashion Event',
        description: 'This is a test description that is long enough to pass validation.',
        location: 'NYC',
        eventTime: new Date().toISOString(),
        contentType: 'photos' as const,
        priceTier: 'standard' as const,
      };

      const result = createJobSchema.safeParse(validJob);
      expect(result.success).toBe(true);
    });

    it('should reject title that is too short', () => {
      const invalidJob = {
        title: 'Too',
        description: 'Valid description here that is long enough.',
        location: 'NYC',
        eventTime: new Date().toISOString(),
        contentType: 'photos' as const,
        priceTier: 'standard' as const,
      };

      const result = createJobSchema.safeParse(invalidJob);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 5 characters');
      }
    });

    it('should reject invalid content type', () => {
      const invalidJob = {
        title: 'Valid Title Here',
        description: 'Valid description here that is long enough.',
        location: 'NYC',
        eventTime: new Date().toISOString(),
        contentType: 'invalid-type',
        priceTier: 'standard',
      };

      const result = createJobSchema.safeParse(invalidJob);
      expect(result.success).toBe(false);
    });

    it('should accept optional notes', () => {
      const jobWithNotes = {
        title: 'Test Event',
        description: 'This is a valid description with enough characters.',
        location: 'NYC',
        eventTime: new Date().toISOString(),
        contentType: 'both' as const,
        notes: 'Some optional notes here',
        priceTier: 'premium' as const,
      };

      const result = createJobSchema.safeParse(jobWithNotes);
      expect(result.success).toBe(true);
    });
  });

  describe('ratingSchema', () => {
    it('should validate a valid rating', () => {
      const validRating = {
        score: 5,
        comment: 'Excellent work!',
      };

      const result = ratingSchema.safeParse(validRating);
      expect(result.success).toBe(true);
    });

    it('should reject score below 1', () => {
      const invalidRating = {
        score: 0,
      };

      const result = ratingSchema.safeParse(invalidRating);
      expect(result.success).toBe(false);
    });

    it('should reject score above 5', () => {
      const invalidRating = {
        score: 6,
      };

      const result = ratingSchema.safeParse(invalidRating);
      expect(result.success).toBe(false);
    });

    it('should allow rating without comment', () => {
      const validRating = {
        score: 4,
      };

      const result = ratingSchema.safeParse(validRating);
      expect(result.success).toBe(true);
    });
  });

  describe('presignedUrlRequestSchema', () => {
    it('should validate a valid upload request', () => {
      const validRequest = {
        jobId: '550e8400-e29b-41d4-a716-446655440000',
        filename: 'test-photo.jpg',
        contentType: 'image/jpeg',
        fileSize: 1024 * 1024, // 1MB
      };

      const result = presignedUrlRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should reject non-UUID job ID', () => {
      const invalidRequest = {
        jobId: 'not-a-uuid',
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        fileSize: 1024,
      };

      const result = presignedUrlRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject invalid content type', () => {
      const invalidRequest = {
        jobId: '550e8400-e29b-41d4-a716-446655440000',
        filename: 'test.pdf',
        contentType: 'application/pdf',
        fileSize: 1024,
      };

      const result = presignedUrlRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject file size exceeding 100MB', () => {
      const invalidRequest = {
        jobId: '550e8400-e29b-41d4-a716-446655440000',
        filename: 'huge-video.mp4',
        contentType: 'video/mp4',
        fileSize: 101 * 1024 * 1024, // 101MB
      };

      const result = presignedUrlRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });

  describe('joinJobSchema', () => {
    it('should validate a valid token', () => {
      const validToken = {
        token: 'valid-token-123',
      };

      const result = joinJobSchema.safeParse(validToken);
      expect(result.success).toBe(true);
    });

    it('should reject empty token', () => {
      const invalidToken = {
        token: '',
      };

      const result = joinJobSchema.safeParse(invalidToken);
      expect(result.success).toBe(false);
    });
  });
});
