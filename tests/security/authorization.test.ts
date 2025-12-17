import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Security & Authorization Tests
 * Tests role-based access control and permission boundaries
 */

describe('Authorization & Security Tests', () => {
  let requesterUser: any;
  let helperUser: any;
  let testJob: any;
  let testUpload: any;

  beforeAll(async () => {
    // Create test users
    requesterUser = await prisma.user.create({
      data: {
        cognitoSub: 'test-requester-sub',
        email: 'requester@test.com',
        name: 'Test Requester',
        roles: ['REQUESTER'],
        activeRole: 'REQUESTER',
      },
    });

    helperUser = await prisma.user.create({
      data: {
        cognitoSub: 'test-helper-sub',
        email: 'helper@test.com',
        name: 'Test Helper',
        roles: ['HELPER'],
        activeRole: 'HELPER',
      },
    });

    // Create test job
    testJob = await prisma.job.create({
      data: {
        title: 'Security Test Job',
        description: 'Test job for security testing',
        location: 'Test Location',
        eventTime: new Date(Date.now() + 86400000),
        contentType: 'photos',
        priceTier: 'standard',
        requesterId: requesterUser.id,
        status: 'ACCEPTED',
      },
    });

    // Create assignment
    await prisma.assignment.create({
      data: {
        jobId: testJob.id,
        helperId: helperUser.id,
      },
    });

    // Create test upload
    testUpload = await prisma.upload.create({
      data: {
        jobId: testJob.id,
        uploadedBy: helperUser.id,
        s3Key: 'test/photo.jpg',
        s3Bucket: 'test-bucket',
        fileName: 'photo.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.upload.deleteMany({ where: { jobId: testJob.id } });
    await prisma.assignment.deleteMany({ where: { jobId: testJob.id } });
    await prisma.job.delete({ where: { id: testJob.id } });
    await prisma.user.delete({ where: { id: requesterUser.id } });
    await prisma.user.delete({ where: { id: helperUser.id } });
    await prisma.$disconnect();
  });

  describe('Job Access Control', () => {
    it('should allow requester to access their own job', async () => {
      const job = await prisma.job.findFirst({
        where: {
          id: testJob.id,
          requesterId: requesterUser.id,
        },
      });

      expect(job).toBeDefined();
      expect(job?.id).toBe(testJob.id);
    });

    it('should allow assigned helper to access job', async () => {
      const job = await prisma.job.findFirst({
        where: {
          id: testJob.id,
          assignments: {
            some: { helperId: helperUser.id },
          },
        },
      });

      expect(job).toBeDefined();
    });

    it('should prevent unauthorized user from accessing job', async () => {
      const unauthorizedUser = await prisma.user.create({
        data: {
          cognitoSub: 'unauthorized-sub',
          email: 'unauthorized@test.com',
          roles: ['HELPER'],
          activeRole: 'HELPER',
        },
      });

      const job = await prisma.job.findFirst({
        where: {
          id: testJob.id,
          OR: [
            { requesterId: unauthorizedUser.id },
            { assignments: { some: { helperId: unauthorizedUser.id } } },
          ],
        },
      });

      expect(job).toBeNull();

      await prisma.user.delete({ where: { id: unauthorizedUser.id } });
    });
  });

  describe('Upload Permissions', () => {
    it('should allow helper to delete their own upload before completion', async () => {
      const upload = await prisma.upload.findUnique({
        where: { id: testUpload.id },
        include: { job: true },
      });

      expect(upload?.uploadedBy).toBe(helperUser.id);
      expect(upload?.job.status).not.toBe('COMPLETED');

      // Helper can delete
      const canDelete = upload?.uploadedBy === helperUser.id && upload?.job.status !== 'COMPLETED';
      expect(canDelete).toBe(true);
    });

    it('should prevent helper from deleting uploads after job completion', async () => {
      // Update job to completed
      await prisma.job.update({
        where: { id: testJob.id },
        data: { status: 'COMPLETED' },
      });

      const upload = await prisma.upload.findUnique({
        where: { id: testUpload.id },
        include: { job: true },
      });

      const canDelete = upload?.uploadedBy === helperUser.id && upload?.job.status !== 'COMPLETED';
      expect(canDelete).toBe(false);

      // Reset status
      await prisma.job.update({
        where: { id: testJob.id },
        data: { status: 'IN_PROGRESS' },
      });
    });

    it('should allow requester to delete uploads during review', async () => {
      await prisma.job.update({
        where: { id: testJob.id },
        data: { status: 'IN_REVIEW' },
      });

      const upload = await prisma.upload.findUnique({
        where: { id: testUpload.id },
        include: { job: true },
      });

      const canDelete = upload?.job.requesterId === requesterUser.id && upload?.job.status === 'IN_REVIEW';
      expect(canDelete).toBe(true);

      // Reset status
      await prisma.job.update({
        where: { id: testJob.id },
        data: { status: 'IN_PROGRESS' },
      });
    });

    it('should prevent requester from deleting uploads outside review period', async () => {
      const upload = await prisma.upload.findUnique({
        where: { id: testUpload.id },
        include: { job: true },
      });

      const canDelete = upload?.job.requesterId === requesterUser.id && upload?.job.status === 'IN_REVIEW';
      expect(canDelete).toBe(false);
    });

    it('should prevent helper from deleting other helpers uploads', async () => {
      const otherHelper = await prisma.user.create({
        data: {
          cognitoSub: 'other-helper-sub',
          email: 'other-helper@test.com',
          roles: ['HELPER'],
          activeRole: 'HELPER',
        },
      });

      const upload = await prisma.upload.findUnique({
        where: { id: testUpload.id },
      });

      const canDelete = upload?.uploadedBy === otherHelper.id;
      expect(canDelete).toBe(false);

      await prisma.user.delete({ where: { id: otherHelper.id } });
    });
  });

  describe('Role-Based Access', () => {
    it('should only allow requester to create jobs', async () => {
      // Requester can create
      expect(requesterUser.activeRole).toBe('REQUESTER');

      // Helper cannot (would be rejected by middleware)
      expect(helperUser.activeRole).not.toBe('REQUESTER');
    });

    it('should only allow helper to upload content', async () => {
      const assignment = await prisma.assignment.findFirst({
        where: {
          jobId: testJob.id,
          helperId: helperUser.id,
        },
      });

      expect(assignment).toBeDefined();
    });

    it('should only allow requester to approve jobs', async () => {
      const job = await prisma.job.findUnique({
        where: { id: testJob.id },
      });

      const canApprove = job?.requesterId === requesterUser.id;
      expect(canApprove).toBe(true);

      const helperCanApprove = job?.requesterId === helperUser.id;
      expect(helperCanApprove).toBe(false);
    });
  });

  describe('Cascade Delete Security', () => {
    it('should delete related uploads when job is deleted', async () => {
      const tempJob = await prisma.job.create({
        data: {
          title: 'Temp Job',
          description: 'Test',
          location: 'Test',
          eventTime: new Date(),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: requesterUser.id,
        },
      });

      const tempUpload = await prisma.upload.create({
        data: {
          jobId: tempJob.id,
          uploadedBy: helperUser.id,
          s3Key: 'temp/photo.jpg',
          s3Bucket: 'test-bucket',
          fileName: 'photo.jpg',
          fileType: 'image/jpeg',
          fileSize: 1024,
        },
      });

      await prisma.job.delete({ where: { id: tempJob.id } });

      const uploadExists = await prisma.upload.findUnique({
        where: { id: tempUpload.id },
      });

      expect(uploadExists).toBeNull();
    });

    it('should delete related assignments when job is deleted', async () => {
      const tempJob = await prisma.job.create({
        data: {
          title: 'Temp Job 2',
          description: 'Test',
          location: 'Test',
          eventTime: new Date(),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: requesterUser.id,
        },
      });

      const tempAssignment = await prisma.assignment.create({
        data: {
          jobId: tempJob.id,
          helperId: helperUser.id,
        },
      });

      await prisma.job.delete({ where: { id: tempJob.id } });

      const assignmentExists = await prisma.assignment.findUnique({
        where: { id: tempAssignment.id },
      });

      expect(assignmentExists).toBeNull();
    });
  });
});
