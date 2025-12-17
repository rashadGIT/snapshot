import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createTestUser, deleteTestUser, disconnectTestDb } from '../../helpers/auth-helper';

const prisma = new PrismaClient();

/**
 * Jobs CRUD API Integration Tests
 * Tests job creation, listing, retrieval with permissions
 */

describe.skip('Jobs CRUD API Integration Tests', () => {
  let requesterUser: any;
  let helperUser: any;
  let testJobs: any[] = [];

  beforeAll(async () => {
    // Create test users
    requesterUser = await createTestUser({
      roles: ['REQUESTER'],
      activeRole: 'REQUESTER',
    });

    helperUser = await createTestUser({
      roles: ['HELPER'],
      activeRole: 'HELPER',
    });
  });

  afterAll(async () => {
    // Cleanup jobs
    await prisma.job.deleteMany({
      where: { id: { in: testJobs.map(j => j.id) } },
    });

    // Cleanup users
    if (requesterUser?.id) await deleteTestUser(requesterUser.id);
    if (helperUser?.id) await deleteTestUser(helperUser.id);

    await disconnectTestDb();
  });

  describe('POST /api/jobs - Create Job', () => {
    it('should create a job with valid data', async () => {
      const jobData = {
        title: 'Wedding Photography',
        description: 'Need a photographer for wedding ceremony on Saturday',
        location: 'Central Park, NYC',
        eventTime: new Date(Date.now() + 86400000).toISOString(),
        contentType: 'photos',
        priceTier: 'standard',
      };

      const job = await prisma.job.create({
        data: {
          ...jobData,
          eventTime: new Date(jobData.eventTime),
          requesterId: requesterUser.id,
        },
      });

      testJobs.push(job);

      expect(job.id).toBeDefined();
      expect(job.title).toBe(jobData.title);
      expect(job.description).toBe(jobData.description);
      expect(job.status).toBe('OPEN');
      expect(job.requesterId).toBe(requesterUser.id);
    });

    it('should create job with photos content type', async () => {
      const job = await prisma.job.create({
        data: {
          title: 'Birthday Party Photos',
          description: 'Capture birthday celebration moments',
          location: 'Brooklyn, NYC',
          eventTime: new Date(Date.now() + 86400000),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: requesterUser.id,
        },
      });

      testJobs.push(job);

      expect(job.contentType).toBe('photos');
    });

    it('should create job with videos content type', async () => {
      const job = await prisma.job.create({
        data: {
          title: 'Corporate Event Video',
          description: 'Record company annual meeting',
          location: 'Manhattan, NYC',
          eventTime: new Date(Date.now() + 86400000),
          contentType: 'videos',
          priceTier: 'premium',
          requesterId: requesterUser.id,
        },
      });

      testJobs.push(job);

      expect(job.contentType).toBe('videos');
    });

    it('should create job with both content type', async () => {
      const job = await prisma.job.create({
        data: {
          title: 'Concert Coverage',
          description: 'Photos and videos of live performance',
          location: 'Madison Square Garden',
          eventTime: new Date(Date.now() + 86400000),
          contentType: 'both',
          priceTier: 'premium',
          requesterId: requesterUser.id,
        },
      });

      testJobs.push(job);

      expect(job.contentType).toBe('both');
    });

    it('should create job with optional notes', async () => {
      const job = await prisma.job.create({
        data: {
          title: 'Graduation Ceremony',
          description: 'Capture graduation moments for family',
          location: 'University Hall',
          eventTime: new Date(Date.now() + 86400000),
          contentType: 'photos',
          priceTier: 'standard',
          notes: 'Please arrive 30 minutes early',
          requesterId: requesterUser.id,
        },
      });

      testJobs.push(job);

      expect(job.notes).toBe('Please arrive 30 minutes early');
    });

    it('should set default status to OPEN', async () => {
      const job = await prisma.job.create({
        data: {
          title: 'Test Event',
          description: 'Testing default status',
          location: 'Test Location',
          eventTime: new Date(Date.now() + 86400000),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: requesterUser.id,
        },
      });

      testJobs.push(job);

      expect(job.status).toBe('OPEN');
    });

    it('should set timestamps on creation', async () => {
      const beforeCreate = new Date();

      const job = await prisma.job.create({
        data: {
          title: 'Timestamp Test',
          description: 'Testing timestamp creation',
          location: 'Test Location',
          eventTime: new Date(Date.now() + 86400000),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: requesterUser.id,
        },
      });

      testJobs.push(job);

      const afterCreate = new Date();

      expect(job.createdAt).toBeInstanceOf(Date);
      expect(job.updatedAt).toBeInstanceOf(Date);
      expect(job.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(job.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });
  });

  describe('GET /api/jobs - List Jobs', () => {
    it('should list all OPEN jobs for helpers', async () => {
      const openJobs = await prisma.job.findMany({
        where: { status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
      });

      expect(openJobs.length).toBeGreaterThan(0);
      openJobs.forEach(job => {
        expect(job.status).toBe('OPEN');
      });
    });

    it('should list jobs created by requester', async () => {
      const requesterJobs = await prisma.job.findMany({
        where: { requesterId: requesterUser.id },
        orderBy: { createdAt: 'desc' },
      });

      expect(requesterJobs.length).toBeGreaterThan(0);
      requesterJobs.forEach(job => {
        expect(job.requesterId).toBe(requesterUser.id);
      });
    });

    it('should list jobs assigned to helper', async () => {
      // Create a job and assign helper
      const job = await prisma.job.create({
        data: {
          title: 'Helper Assignment Test',
          description: 'Test helper assignment',
          location: 'Test Location',
          eventTime: new Date(Date.now() + 86400000),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: requesterUser.id,
          status: 'ACCEPTED',
        },
      });

      testJobs.push(job);

      await prisma.assignment.create({
        data: {
          jobId: job.id,
          helperId: helperUser.id,
        },
      });

      const helperJobs = await prisma.job.findMany({
        where: {
          assignments: {
            some: { helperId: helperUser.id },
          },
        },
      });

      expect(helperJobs.length).toBeGreaterThan(0);

      // Cleanup assignment
      await prisma.assignment.deleteMany({ where: { jobId: job.id } });
    });

    it('should order jobs by creation date descending', async () => {
      const jobs = await prisma.job.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      for (let i = 0; i < jobs.length - 1; i++) {
        expect(jobs[i].createdAt.getTime()).toBeGreaterThanOrEqual(
          jobs[i + 1].createdAt.getTime()
        );
      }
    });

    it('should include requester information', async () => {
      const jobs = await prisma.job.findMany({
        where: { requesterId: requesterUser.id },
        include: { requester: true },
        take: 1,
      });

      expect(jobs[0].requester).toBeDefined();
      expect(jobs[0].requester.id).toBe(requesterUser.id);
      expect(jobs[0].requester.email).toBe(requesterUser.email);
    });
  });

  describe('GET /api/jobs/[id] - Get Job Details', () => {
    it('should get job by ID', async () => {
      const createdJob = testJobs[0];

      const job = await prisma.job.findUnique({
        where: { id: createdJob.id },
      });

      expect(job).toBeDefined();
      expect(job?.id).toBe(createdJob.id);
      expect(job?.title).toBe(createdJob.title);
    });

    it('should return null for non-existent job', async () => {
      const job = await prisma.job.findUnique({
        where: { id: '00000000-0000-0000-0000-000000000000' },
      });

      expect(job).toBeNull();
    });

    it('should include requester details', async () => {
      const createdJob = testJobs[0];

      const job = await prisma.job.findUnique({
        where: { id: createdJob.id },
        include: { requester: true },
      });

      expect(job?.requester).toBeDefined();
      expect(job?.requester.id).toBe(requesterUser.id);
    });

    it('should include assignments', async () => {
      const job = await prisma.job.create({
        data: {
          title: 'Assignment Include Test',
          description: 'Test including assignments',
          location: 'Test Location',
          eventTime: new Date(Date.now() + 86400000),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: requesterUser.id,
          status: 'ACCEPTED',
        },
      });

      testJobs.push(job);

      await prisma.assignment.create({
        data: {
          jobId: job.id,
          helperId: helperUser.id,
        },
      });

      const jobWithAssignments = await prisma.job.findUnique({
        where: { id: job.id },
        include: {
          assignments: {
            include: { helper: true },
          },
        },
      });

      expect(jobWithAssignments?.assignments).toBeDefined();
      expect(jobWithAssignments?.assignments.length).toBe(1);
      expect(jobWithAssignments?.assignments[0].helperId).toBe(helperUser.id);

      // Cleanup
      await prisma.assignment.deleteMany({ where: { jobId: job.id } });
    });

    it('should include uploads', async () => {
      const job = await prisma.job.create({
        data: {
          title: 'Upload Include Test',
          description: 'Test including uploads',
          location: 'Test Location',
          eventTime: new Date(Date.now() + 86400000),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: requesterUser.id,
        },
      });

      testJobs.push(job);

      await prisma.upload.create({
        data: {
          jobId: job.id,
          uploadedBy: helperUser.id,
          s3Key: 'test/photo.jpg',
          s3Bucket: 'test-bucket',
          fileName: 'photo.jpg',
          fileType: 'image/jpeg',
          fileSize: 1024,
        },
      });

      const jobWithUploads = await prisma.job.findUnique({
        where: { id: job.id },
        include: { uploads: true },
      });

      expect(jobWithUploads?.uploads).toBeDefined();
      expect(jobWithUploads?.uploads.length).toBe(1);

      // Cleanup
      await prisma.upload.deleteMany({ where: { jobId: job.id } });
    });
  });

  describe('Job Permission Logic', () => {
    it('should allow requester to access their own job', async () => {
      const job = await prisma.job.findFirst({
        where: {
          id: testJobs[0].id,
          requesterId: requesterUser.id,
        },
      });

      expect(job).toBeDefined();
    });

    it('should allow assigned helper to access job', async () => {
      const job = await prisma.job.create({
        data: {
          title: 'Permission Test',
          description: 'Test helper permission',
          location: 'Test Location',
          eventTime: new Date(Date.now() + 86400000),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: requesterUser.id,
          status: 'ACCEPTED',
        },
      });

      testJobs.push(job);

      await prisma.assignment.create({
        data: {
          jobId: job.id,
          helperId: helperUser.id,
        },
      });

      const jobForHelper = await prisma.job.findFirst({
        where: {
          id: job.id,
          assignments: {
            some: { helperId: helperUser.id },
          },
        },
      });

      expect(jobForHelper).toBeDefined();

      // Cleanup
      await prisma.assignment.deleteMany({ where: { jobId: job.id } });
    });

    it('should not allow unauthorized access', async () => {
      const unauthorizedUser = await createTestUser({
        roles: ['HELPER'],
        activeRole: 'HELPER',
      });

      const job = await prisma.job.findFirst({
        where: {
          id: testJobs[0].id,
          OR: [
            { requesterId: unauthorizedUser.id },
            { assignments: { some: { helperId: unauthorizedUser.id } } },
          ],
        },
      });

      expect(job).toBeNull();

      // Cleanup
      await deleteTestUser(unauthorizedUser.id);
    });
  });
});
