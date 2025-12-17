import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Jobs API Integration Tests', () => {
  let testUser: any;
  let testJob: any;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        cognitoSub: 'test-cognito-sub',
        email: 'test@example.com',
        name: 'Test User',
        roles: ['REQUESTER', 'HELPER'],
        activeRole: 'REQUESTER',
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    if (testJob) {
      await prisma.job.delete({ where: { id: testJob.id } });
    }
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.$disconnect();
  });

  describe('POST /api/jobs', () => {
    it('should create a new job', async () => {
      const jobData = {
        title: 'Test Job',
        description: 'Capture photos of event',
        location: 'San Francisco',
        eventTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        contentType: 'photos',
        priceTier: 'standard',
      };

      testJob = await prisma.job.create({
        data: {
          ...jobData,
          eventTime: new Date(jobData.eventTime),
          requesterId: testUser.id,
        },
      });

      expect(testJob).toBeDefined();
      expect(testJob.title).toBe(jobData.title);
      expect(testJob.status).toBe('OPEN');
      expect(testJob.requesterId).toBe(testUser.id);
    });
  });

  describe('GET /api/jobs', () => {
    it('should list jobs for requester', async () => {
      const jobs = await prisma.job.findMany({
        where: { requesterId: testUser.id },
      });

      expect(Array.isArray(jobs)).toBe(true);
      expect(jobs.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/jobs/[id]', () => {
    it('should fetch job details', async () => {
      const job = await prisma.job.findUnique({
        where: { id: testJob.id },
        include: {
          requester: true,
          assignments: true,
          uploads: true,
        },
      });

      expect(job).toBeDefined();
      expect(job?.requester.id).toBe(testUser.id);
    });
  });

  describe('Job Status Transitions', () => {
    it('should allow OPEN -> ACCEPTED', async () => {
      const updated = await prisma.job.update({
        where: { id: testJob.id },
        data: { status: 'ACCEPTED' },
      });

      expect(updated.status).toBe('ACCEPTED');
    });

    it('should allow ACCEPTED -> IN_PROGRESS', async () => {
      const updated = await prisma.job.update({
        where: { id: testJob.id },
        data: { status: 'IN_PROGRESS' },
      });

      expect(updated.status).toBe('IN_PROGRESS');
    });

    it('should allow IN_PROGRESS -> IN_REVIEW', async () => {
      const updated = await prisma.job.update({
        where: { id: testJob.id },
        data: { status: 'IN_REVIEW', submittedAt: new Date() },
      });

      expect(updated.status).toBe('IN_REVIEW');
      expect(updated.submittedAt).toBeDefined();
    });

    it('should allow IN_REVIEW -> COMPLETED', async () => {
      const updated = await prisma.job.update({
        where: { id: testJob.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      expect(updated.status).toBe('COMPLETED');
      expect(updated.completedAt).toBeDefined();
    });
  });
});
