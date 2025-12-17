import { describe, it, expect } from 'vitest';
import { generateS3Key, getPublicUrl } from '@/lib/storage/s3';

describe.skip('S3 Storage Utilities', () => {
  describe('generateS3Key', () => {
    it('should generate key with jobId and filename', () => {
      const key = generateS3Key('job-123', 'photo.jpg');
      expect(key).toMatch(/^job-123\/[a-f0-9-]+-photo\.jpg$/);
    });

    it('should sanitize filename with special characters', () => {
      const key = generateS3Key('job-123', 'my photo!@#.jpg');
      expect(key).toMatch(/^job-123\/[a-f0-9-]+-my_photo___.jpg$/);
    });

    it('should remove path traversal attempts', () => {
      const key = generateS3Key('job-123', '../../../etc/passwd');
      expect(key).not.toContain('../');
      expect(key).toMatch(/^job-123\/[a-f0-9-]+-passwd$/);
    });

    it('should preserve file extension', () => {
      const key = generateS3Key('job-123', 'video.mp4');
      expect(key).toMatch(/\.mp4$/);
    });
  });

  describe('getPublicUrl', () => {
    it('should generate correct LocalStack URL in development', () => {
      const originalEnv = process.env.AWS_ENDPOINT_URL;
      process.env.AWS_ENDPOINT_URL = 'http://localhost:4566';
      process.env.AWS_S3_BUCKET = 'test-bucket';

      const url = getPublicUrl('job-123/test.jpg');
      expect(url).toBe('http://localhost:4566/test-bucket/job-123/test.jpg');

      process.env.AWS_ENDPOINT_URL = originalEnv;
    });

    it('should generate S3 URL when no endpoint specified', () => {
      const originalEnv = process.env.AWS_ENDPOINT_URL;
      delete process.env.AWS_ENDPOINT_URL;
      process.env.AWS_S3_BUCKET = 'prod-bucket';
      process.env.AWS_REGION = 'us-east-1';

      const url = getPublicUrl('job-123/test.jpg');
      expect(url).toBe('https://prod-bucket.s3.us-east-1.amazonaws.com/job-123/test.jpg');

      process.env.AWS_ENDPOINT_URL = originalEnv;
    });
  });
});
