/**
 * Unit Tests: Job Status Transitions
 * Tests the job status state machine
 */

import { validateStatusTransition } from '@/lib/validation/schemas';
import { JobStatus } from '@prisma/client';

describe('Job Status Transitions', () => {
  describe('OPEN status', () => {
    it('should allow transition to ACCEPTED', () => {
      const result = validateStatusTransition(JobStatus.OPEN, JobStatus.ACCEPTED);
      expect(result.valid).toBe(true);
    });

    it('should allow transition to CANCELLED', () => {
      const result = validateStatusTransition(JobStatus.OPEN, JobStatus.CANCELLED);
      expect(result.valid).toBe(true);
    });

    it('should reject transition to IN_PROGRESS', () => {
      const result = validateStatusTransition(JobStatus.OPEN, JobStatus.IN_PROGRESS);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject transition to UPLOADED', () => {
      const result = validateStatusTransition(JobStatus.OPEN, JobStatus.UPLOADED);
      expect(result.valid).toBe(false);
    });

    it('should reject transition to COMPLETED', () => {
      const result = validateStatusTransition(JobStatus.OPEN, JobStatus.COMPLETED);
      expect(result.valid).toBe(false);
    });
  });

  describe('ACCEPTED status', () => {
    it('should allow transition to IN_PROGRESS', () => {
      const result = validateStatusTransition(JobStatus.ACCEPTED, JobStatus.IN_PROGRESS);
      expect(result.valid).toBe(true);
    });

    it('should allow transition to CANCELLED', () => {
      const result = validateStatusTransition(JobStatus.ACCEPTED, JobStatus.CANCELLED);
      expect(result.valid).toBe(true);
    });

    it('should reject transition to OPEN', () => {
      const result = validateStatusTransition(JobStatus.ACCEPTED, JobStatus.OPEN);
      expect(result.valid).toBe(false);
    });

    it('should reject transition to UPLOADED', () => {
      const result = validateStatusTransition(JobStatus.ACCEPTED, JobStatus.UPLOADED);
      expect(result.valid).toBe(false);
    });
  });

  describe('IN_PROGRESS status', () => {
    it('should allow transition to UPLOADED', () => {
      const result = validateStatusTransition(JobStatus.IN_PROGRESS, JobStatus.UPLOADED);
      expect(result.valid).toBe(true);
    });

    it('should allow transition to CANCELLED', () => {
      const result = validateStatusTransition(JobStatus.IN_PROGRESS, JobStatus.CANCELLED);
      expect(result.valid).toBe(true);
    });

    it('should reject transition to COMPLETED directly', () => {
      const result = validateStatusTransition(JobStatus.IN_PROGRESS, JobStatus.COMPLETED);
      expect(result.valid).toBe(false);
    });
  });

  describe('UPLOADED status', () => {
    it('should allow transition to COMPLETED', () => {
      const result = validateStatusTransition(JobStatus.UPLOADED, JobStatus.COMPLETED);
      expect(result.valid).toBe(true);
    });

    it('should allow transition to CANCELLED', () => {
      const result = validateStatusTransition(JobStatus.UPLOADED, JobStatus.CANCELLED);
      expect(result.valid).toBe(true);
    });

    it('should reject transition to IN_PROGRESS', () => {
      const result = validateStatusTransition(JobStatus.UPLOADED, JobStatus.IN_PROGRESS);
      expect(result.valid).toBe(false);
    });
  });

  describe('COMPLETED status (terminal)', () => {
    it('should reject all transitions from COMPLETED', () => {
      const statuses = [
        JobStatus.OPEN,
        JobStatus.ACCEPTED,
        JobStatus.IN_PROGRESS,
        JobStatus.UPLOADED,
        JobStatus.CANCELLED,
      ];

      statuses.forEach((status) => {
        const result = validateStatusTransition(JobStatus.COMPLETED, status);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('CANCELLED status (terminal)', () => {
    it('should reject all transitions from CANCELLED', () => {
      const statuses = [
        JobStatus.OPEN,
        JobStatus.ACCEPTED,
        JobStatus.IN_PROGRESS,
        JobStatus.UPLOADED,
        JobStatus.COMPLETED,
      ];

      statuses.forEach((status) => {
        const result = validateStatusTransition(JobStatus.CANCELLED, status);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Complete workflow path', () => {
    it('should validate the happy path: OPEN → ACCEPTED → IN_PROGRESS → UPLOADED → COMPLETED', () => {
      const transitions = [
        { from: JobStatus.OPEN, to: JobStatus.ACCEPTED },
        { from: JobStatus.ACCEPTED, to: JobStatus.IN_PROGRESS },
        { from: JobStatus.IN_PROGRESS, to: JobStatus.UPLOADED },
        { from: JobStatus.UPLOADED, to: JobStatus.COMPLETED },
      ];

      transitions.forEach(({ from, to }) => {
        const result = validateStatusTransition(from, to);
        expect(result.valid).toBe(true);
      });
    });

    it('should allow cancellation from any non-terminal status', () => {
      const cancellableStatuses = [
        JobStatus.OPEN,
        JobStatus.ACCEPTED,
        JobStatus.IN_PROGRESS,
        JobStatus.UPLOADED,
      ];

      cancellableStatuses.forEach((status) => {
        const result = validateStatusTransition(status, JobStatus.CANCELLED);
        expect(result.valid).toBe(true);
      });
    });
  });
});
