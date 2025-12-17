import { describe, it, expect } from 'vitest';
import { validateStatusTransition } from '@/lib/validation/schemas';
import { JobStatus } from '@prisma/client';

describe('Job Status Validation', () => {
  describe('validateStatusTransition', () => {
    it('should allow OPEN -> ACCEPTED', () => {
      const result = validateStatusTransition(JobStatus.OPEN, JobStatus.ACCEPTED);
      expect(result.valid).toBe(true);
    });

    it('should allow ACCEPTED -> IN_PROGRESS', () => {
      const result = validateStatusTransition(JobStatus.ACCEPTED, JobStatus.IN_PROGRESS);
      expect(result.valid).toBe(true);
    });

    it('should allow IN_PROGRESS -> IN_REVIEW', () => {
      const result = validateStatusTransition(JobStatus.IN_PROGRESS, JobStatus.IN_REVIEW);
      expect(result.valid).toBe(true);
    });

    it('should allow IN_REVIEW -> COMPLETED', () => {
      const result = validateStatusTransition(JobStatus.IN_REVIEW, JobStatus.COMPLETED);
      expect(result.valid).toBe(true);
    });

    it('should allow any status -> CANCELLED', () => {
      expect(validateStatusTransition(JobStatus.OPEN, JobStatus.CANCELLED).valid).toBe(true);
      expect(validateStatusTransition(JobStatus.ACCEPTED, JobStatus.CANCELLED).valid).toBe(true);
      expect(validateStatusTransition(JobStatus.IN_PROGRESS, JobStatus.CANCELLED).valid).toBe(true);
    });

    it('should reject invalid transitions', () => {
      const result = validateStatusTransition(JobStatus.OPEN, JobStatus.IN_PROGRESS);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject transitions from COMPLETED', () => {
      const result = validateStatusTransition(JobStatus.COMPLETED, JobStatus.IN_PROGRESS);
      expect(result.valid).toBe(false);
    });

    it('should reject transitions from CANCELLED', () => {
      const result = validateStatusTransition(JobStatus.CANCELLED, JobStatus.OPEN);
      expect(result.valid).toBe(false);
    });
  });
});
