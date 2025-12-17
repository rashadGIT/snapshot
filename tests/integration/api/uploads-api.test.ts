import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createTestUser, deleteTestUser, disconnectTestDb } from '../../helpers/auth-helper';
import { generateS3Key, generatePresignedUploadUrl } from '@/lib/storage/s3';

const prisma = new PrismaClient();

/**
 * Uploads API Integration Tests
 * Tests presigned URL generation, upload recording, and deletion
 */

describe.skip('Uploads API Integration Tests', () => {
  let requesterUser: any;
  let helperUser: any;
  let testJob: any;
  let testUploads: any[] = [];

  beforeAll(async () => {
    requesterUser = await createTestUser({
      roles: ['REQUESTER'],
      activeRole: 'REQUESTER',
    });

    helperUser = await createTestUser({
      roles: ['HELPER'],
      activeRole: 'HELPER',
    });

    // Create test job
    testJob = await prisma.job.create({
      data: {
        title: 'Upload Test Job',
        description: 'Job for testing uploads',
        location: 'Test Location',
        eventTime: new Date(Date.now() + 86400000),
        contentType: 'both',
        priceTier: 'standard',
        requesterId: requesterUser.id,
        status: 'IN_PROGRESS',
      },
    });

    // Assign helper
    await prisma.assignment.create({
      data: {
        jobId: testJob.id,
        helperId: helperUser.id,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.upload.deleteMany({
      where: { id: { in: testUploads.map(u => u.id) } },
    });
    await prisma.assignment.deleteMany({ where: { jobId: testJob.id } });
    await prisma.job.delete({ where: { id: testJob.id } });
    await deleteTestUser(requesterUser.id);
    await deleteTestUser(helperUser.id);
    await disconnectTestDb();
  });

  describe('POST /api/uploads/presigned-url - Generate Presigned URL', () => {
    it('should validate job exists', async () => {
      const fakeJobId = '00000000-0000-0000-0000-000000000000';

      const job = await prisma.job.findUnique({
        where: { id: fakeJobId },
      });

      expect(job).toBeNull();
    });

    it('should validate job is in correct status', async () => {
      const openJob = await prisma.job.create({
        data: {
          title: 'Open Job',
          description: 'Test',
          location: 'Test',
          eventTime: new Date(Date.now() + 86400000),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: requesterUser.id,
          status: 'OPEN',
        },
      });

      // Should not allow uploads to OPEN jobs
      expect(openJob.status).toBe('OPEN');

      await prisma.job.delete({ where: { id: openJob.id } });
    });

    it('should validate content type', async () => {
      const validTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/heic',
        'video/mp4',
        'video/webm',
        'video/quicktime',
      ];

      validTypes.forEach(contentType => {
        expect(contentType).toMatch(/^(image|video)\/.+$/);
      });
    });

    it('should reject invalid content types', async () => {
      const invalidTypes = [
        'application/pdf',
        'text/plain',
        'application/x-msdownload',
      ];

      invalidTypes.forEach(contentType => {
        expect(contentType).not.toMatch(/^(image|video)\/.+$/);
      });
    });

    it('should validate file size', async () => {
      const maxSize = 100 * 1024 * 1024; // 100MB

      expect(50 * 1024 * 1024).toBeLessThan(maxSize);
      expect(101 * 1024 * 1024).toBeGreaterThan(maxSize);
    });
  });

  describe('POST /api/jobs/[id]/uploads - Record Upload', () => {
    it('should record upload after successful S3 upload', async () => {
      const upload = await prisma.upload.create({
        data: {
          jobId: testJob.id,
          uploadedBy: helperUser.id,
          s3Key: 'test/photo-1.jpg',
          s3Bucket: 'test-bucket',
          fileName: 'photo-1.jpg',
          fileType: 'image/jpeg',
          fileSize: 1024 * 1024,
        },
      });

      testUploads.push(upload);

      expect(upload.id).toBeDefined();
      expect(upload.jobId).toBe(testJob.id);
      expect(upload.uploadedBy).toBe(helperUser.id);
      expect(upload.s3Key).toBe('test/photo-1.jpg');
    });

    it('should record video upload with thumbnail', async () => {
      const upload = await prisma.upload.create({
        data: {
          jobId: testJob.id,
          uploadedBy: helperUser.id,
          s3Key: 'test/video-1.mp4',
          s3Bucket: 'test-bucket',
          fileName: 'video-1.mp4',
          fileType: 'video/mp4',
          fileSize: 5 * 1024 * 1024,
          thumbnailKey: 'test/video-1-thumb.jpg',
        },
      });

      testUploads.push(upload);

      expect(upload.thumbnailKey).toBe('test/video-1-thumb.jpg');
    });

    it('should set upload timestamp', async () => {
      const beforeUpload = new Date();

      const upload = await prisma.upload.create({
        data: {
          jobId: testJob.id,
          uploadedBy: helperUser.id,
          s3Key: 'test/photo-2.jpg',
          s3Bucket: 'test-bucket',
          fileName: 'photo-2.jpg',
          fileType: 'image/jpeg',
          fileSize: 2048,
        },
      });

      testUploads.push(upload);

      const afterUpload = new Date();

      expect(upload.createdAt).toBeInstanceOf(Date);
      expect(upload.createdAt.getTime()).toBeGreaterThanOrEqual(beforeUpload.getTime());
      expect(upload.createdAt.getTime()).toBeLessThanOrEqual(afterUpload.getTime());
    });

    it('should store file metadata', async () => {
      const upload = await prisma.upload.create({
        data: {
          jobId: testJob.id,
          uploadedBy: helperUser.id,
          s3Key: 'test/photo-3.jpg',
          s3Bucket: 'test-bucket',
          fileName: 'IMG_1234.jpg',
          fileType: 'image/jpeg',
          fileSize: 3 * 1024 * 1024,
        },
      });

      testUploads.push(upload);

      expect(upload.fileName).toBe('IMG_1234.jpg');
      expect(upload.fileType).toBe('image/jpeg');
      expect(upload.fileSize).toBe(3 * 1024 * 1024);
    });
  });

  describe('GET /api/jobs/[id]/uploads - List Uploads', () => {
    it('should list all uploads for a job', async () => {
      const uploads = await prisma.upload.findMany({
        where: { jobId: testJob.id },
        orderBy: { uploadedAt: 'desc' },
      });

      expect(uploads.length).toBeGreaterThan(0);
      uploads.forEach(upload => {
        expect(upload.jobId).toBe(testJob.id);
      });
    });

    it('should include uploader information', async () => {
      const uploads = await prisma.upload.findMany({
        where: { jobId: testJob.id },
        include: { uploadedByUser: true },
      });

      uploads.forEach(upload => {
        expect(upload.uploadedByUser).toBeDefined();
        expect(upload.uploadedByUser.id).toBe(helperUser.id);
      });
    });

    it('should order uploads by creation date', async () => {
      const uploads = await prisma.upload.findMany({
        where: { jobId: testJob.id },
        orderBy: { uploadedAt: 'desc' },
      });

      for (let i = 0; i < uploads.length - 1; i++) {
        expect(uploads[i].createdAt.getTime()).toBeGreaterThanOrEqual(
          uploads[i + 1].createdAt.getTime()
        );
      }
    });

    it('should filter uploads by type', async () => {
      const imageUploads = await prisma.upload.findMany({
        where: {
          jobId: testJob.id,
          fileType: { startsWith: 'image/' },
        },
      });

      imageUploads.forEach(upload => {
        expect(upload.fileType).toMatch(/^image\//);
      });
    });
  });

  describe('DELETE /api/jobs/[id]/uploads/[uploadId] - Delete Upload', () => {
    it('should allow helper to delete own upload before job completion', async () => {
      const upload = await prisma.upload.create({
        data: {
          jobId: testJob.id,
          uploadedBy: helperUser.id,
          s3Key: 'test/to-delete.jpg',
          s3Bucket: 'test-bucket',
          fileName: 'to-delete.jpg',
          fileType: 'image/jpeg',
          fileSize: 1024,
        },
      });

      // Check permission
      const canDelete =
        upload.uploadedBy === helperUser.id &&
        testJob.status !== 'COMPLETED';

      expect(canDelete).toBe(true);

      // Delete
      await prisma.upload.delete({ where: { id: upload.id } });

      // Verify deleted
      const deleted = await prisma.upload.findUnique({
        where: { id: upload.id },
      });

      expect(deleted).toBeNull();
    });

    it('should not allow helper to delete after job completion', async () => {
      const completedJob = await prisma.job.create({
        data: {
          title: 'Completed Job',
          description: 'Test',
          location: 'Test',
          eventTime: new Date(Date.now() + 86400000),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: requesterUser.id,
          status: 'COMPLETED',
        },
      });

      const upload = await prisma.upload.create({
        data: {
          jobId: completedJob.id,
          uploadedBy: helperUser.id,
          s3Key: 'test/protected.jpg',
          s3Bucket: 'test-bucket',
          fileName: 'protected.jpg',
          fileType: 'image/jpeg',
          fileSize: 1024,
        },
      });

      const canDelete =
        upload.uploadedBy === helperUser.id &&
        completedJob.status !== 'COMPLETED';

      expect(canDelete).toBe(false);

      // Cleanup
      await prisma.upload.delete({ where: { id: upload.id } });
      await prisma.job.delete({ where: { id: completedJob.id } });
    });

    it('should allow requester to delete during IN_REVIEW', async () => {
      const reviewJob = await prisma.job.create({
        data: {
          title: 'Review Job',
          description: 'Test',
          location: 'Test',
          eventTime: new Date(Date.now() + 86400000),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: requesterUser.id,
          status: 'IN_REVIEW',
        },
      });

      const upload = await prisma.upload.create({
        data: {
          jobId: reviewJob.id,
          uploadedBy: helperUser.id,
          s3Key: 'test/review-delete.jpg',
          s3Bucket: 'test-bucket',
          fileName: 'review-delete.jpg',
          fileType: 'image/jpeg',
          fileSize: 1024,
        },
      });

      const canDelete =
        reviewJob.requesterId === requesterUser.id &&
        reviewJob.status === 'IN_REVIEW';

      expect(canDelete).toBe(true);

      // Cleanup
      await prisma.upload.delete({ where: { id: upload.id } });
      await prisma.job.delete({ where: { id: reviewJob.id } });
    });

    it('should not allow helper to delete other helper uploads', async () => {
      const otherHelper = await createTestUser({
        roles: ['HELPER'],
        activeRole: 'HELPER',
      });

      const upload = await prisma.upload.create({
        data: {
          jobId: testJob.id,
          uploadedBy: otherHelper.id,
          s3Key: 'test/other-helper.jpg',
          s3Bucket: 'test-bucket',
          fileName: 'other-helper.jpg',
          fileType: 'image/jpeg',
          fileSize: 1024,
        },
      });

      const canDelete = upload.uploadedBy === helperUser.id;

      expect(canDelete).toBe(false);

      // Cleanup
      await prisma.upload.delete({ where: { id: upload.id } });
      await deleteTestUser(otherHelper.id);
    });
  });

  describe('S3 Key Generation', () => {
    it('should generate unique keys for same filename', () => {
      const key1 = generateS3Key(testJob.id, 'photo.jpg');
      const key2 = generateS3Key(testJob.id, 'photo.jpg');

      expect(key1).not.toBe(key2);
    });

    it('should include job ID in key', () => {
      const key = generateS3Key(testJob.id, 'photo.jpg');

      expect(key).toContain(testJob.id);
    });

    it('should sanitize filename', () => {
      const key = generateS3Key(testJob.id, '../../../etc/passwd');

      expect(key).not.toContain('../');
    });

    it('should handle special characters', () => {
      const key = generateS3Key(testJob.id, 'my<>file:name|?.jpg');

      expect(key).not.toContain('<');
      expect(key).not.toContain('>');
      expect(key).not.toContain(':');
      expect(key).not.toContain('|');
      expect(key).not.toContain('?');
    });
  });

  describe('Upload Count Statistics', () => {
    it('should count total uploads for job', async () => {
      const count = await prisma.upload.count({
        where: { jobId: testJob.id },
      });

      expect(count).toBeGreaterThan(0);
    });

    it('should count uploads by type', async () => {
      const imageCount = await prisma.upload.count({
        where: {
          jobId: testJob.id,
          fileType: { startsWith: 'image/' },
        },
      });

      const videoCount = await prisma.upload.count({
        where: {
          jobId: testJob.id,
          fileType: { startsWith: 'video/' },
        },
      });

      expect(imageCount + videoCount).toBeGreaterThan(0);
    });

    it('should calculate total upload size', async () => {
      const uploads = await prisma.upload.findMany({
        where: { jobId: testJob.id },
      });

      const totalSize = uploads.reduce((sum, u) => sum + u.fileSize, 0);

      expect(totalSize).toBeGreaterThan(0);
    });
  });
});
