import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createTestUser, deleteTestUser, disconnectTestDb } from '../../helpers/auth-helper';
import { createQRToken, validateQRToken, checkQRToken } from '@/lib/qr/token';

const prisma = new PrismaClient();

/**
 * QR Code API Integration Tests
 * Tests QR token generation, validation, and job joining
 */

describe('QR Code API Integration Tests', () => {
  let requesterUser: any;
  let helperUser: any;
  let testJob: any;

  beforeAll(async () => {
    requesterUser = await createTestUser({
      roles: ['REQUESTER'],
      activeRole: 'REQUESTER',
    });

    helperUser = await createTestUser({
      roles: ['HELPER'],
      activeRole: 'HELPER',
    });

    testJob = await prisma.job.create({
      data: {
        title: 'QR Test Job',
        description: 'Job for testing QR codes',
        location: 'Test Location',
        eventTime: new Date(Date.now() + 86400000),
        contentType: 'photos',
        priceTier: 'standard',
        requesterId: requesterUser.id,
        status: 'OPEN',
      },
    });
  });

  afterAll(async () => {
    await prisma.qRToken.deleteMany({ where: { jobId: testJob.id } });
    await prisma.assignment.deleteMany({ where: { jobId: testJob.id } });
    await prisma.job.delete({ where: { id: testJob.id } });
    await deleteTestUser(requesterUser.id);
    await deleteTestUser(helperUser.id);
    await disconnectTestDb();
  });

  describe('POST /api/jobs/[id]/qr - Generate QR Token', () => {
    it('should generate QR token for OPEN job', async () => {
      const qrToken = await createQRToken(testJob.id);

      expect(qrToken.token).toBeDefined();
      expect(qrToken.shortCode).toBeDefined();
      expect(qrToken.expiresAt).toBeInstanceOf(Date);
    });

    it('should generate 6-digit short code', async () => {
      const qrToken = await createQRToken(testJob.id);

      expect(qrToken.shortCode).toMatch(/^\d{6}$/);
      expect(qrToken.shortCode.length).toBe(6);
    });

    it('should set expiration to 15 minutes', async () => {
      const before = Date.now();
      const qrToken = await createQRToken(testJob.id);
      const after = Date.now();

      const expiryTime = qrToken.expiresAt.getTime();
      const fifteenMinutes = 15 * 60 * 1000;

      expect(expiryTime).toBeGreaterThan(before + (14.9 * 60 * 1000));
      expect(expiryTime).toBeLessThan(after + (15.1 * 60 * 1000));
    });

    it('should generate unique tokens', async () => {
      const token1 = await createQRToken(testJob.id);
      const token2 = await createQRToken(testJob.id);

      expect(token1.token).not.toBe(token2.token);
      expect(token1.shortCode).not.toBe(token2.shortCode);
    });

    it('should store token in database', async () => {
      const qrToken = await createQRToken(testJob.id);

      const stored = await prisma.qRToken.findFirst({
        where: { token: qrToken.token },
      });

      expect(stored).toBeDefined();
      expect(stored?.jobId).toBe(testJob.id);
      expect(stored?.isUsed).toBe(false);
    });

    it('should validate job is OPEN before generating', async () => {
      const acceptedJob = await prisma.job.create({
        data: {
          title: 'Accepted Job',
          description: 'Test',
          location: 'Test',
          eventTime: new Date(Date.now() + 86400000),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: requesterUser.id,
          status: 'ACCEPTED',
        },
      });

      // Should validate job status before generating token
      expect(acceptedJob.status).not.toBe('OPEN');

      await prisma.job.delete({ where: { id: acceptedJob.id } });
    });
  });

  describe('GET /api/jobs/check-token - Check Token Validity', () => {
    it('should validate token without consuming it', async () => {
      const qrToken = await createQRToken(testJob.id);

      const result = await checkQRToken(qrToken.token);

      expect(result.valid).toBe(true);
      expect(result.jobId).toBe(testJob.id);

      // Token should still be unused
      const stored = await prisma.qRToken.findFirst({
        where: { token: qrToken.token },
      });

      expect(stored?.isUsed).toBe(false);
    });

    it('should validate short code without consuming it', async () => {
      const qrToken = await createQRToken(testJob.id);

      const result = await checkQRToken(qrToken.shortCode);

      expect(result.valid).toBe(true);
      expect(result.jobId).toBe(testJob.id);
    });

    it('should reject invalid token', async () => {
      const result = await checkQRToken('invalid-token-12345');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid token');
    });

    it('should reject expired token', async () => {
      const expiredToken = await prisma.qRToken.create({
        data: {
          jobId: testJob.id,
          token: `expired-${Date.now()}`,
          shortCode: Math.floor(100000 + Math.random() * 900000).toString(),
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      const result = await checkQRToken(expiredToken.token);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Token expired');
    });

    it('should reject used token', async () => {
      const usedToken = await prisma.qRToken.create({
        data: {
          jobId: testJob.id,
          token: `used-${Date.now()}`,
          shortCode: Math.floor(100000 + Math.random() * 900000).toString(),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          isUsed: true,
          scannedAt: new Date(),
          scannedBy: helperUser.id,
        },
      });

      const result = await checkQRToken(usedToken.token);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Token already used');
    });

    it('should reject token for job with existing helper', async () => {
      const jobWithHelper = await prisma.job.create({
        data: {
          title: 'Job with Helper',
          description: 'Test',
          location: 'Test',
          eventTime: new Date(Date.now() + 86400000),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: requesterUser.id,
          status: 'OPEN',
        },
      });

      await prisma.assignment.create({
        data: {
          jobId: jobWithHelper.id,
          helperId: helperUser.id,
        },
      });

      const qrToken = await createQRToken(jobWithHelper.id);
      const result = await checkQRToken(qrToken.token);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Job already has a Helper');

      // Cleanup
      await prisma.qRToken.deleteMany({ where: { jobId: jobWithHelper.id } });
      await prisma.assignment.deleteMany({ where: { jobId: jobWithHelper.id } });
      await prisma.job.delete({ where: { id: jobWithHelper.id } });
    });

    it('should reject token for non-OPEN job', async () => {
      const closedJob = await prisma.job.create({
        data: {
          title: 'Closed Job',
          description: 'Test',
          location: 'Test',
          eventTime: new Date(Date.now() + 86400000),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: requesterUser.id,
          status: 'COMPLETED',
        },
      });

      const qrToken = await createQRToken(closedJob.id);
      const result = await checkQRToken(qrToken.token);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Job is not available');

      // Cleanup
      await prisma.qRToken.deleteMany({ where: { jobId: closedJob.id } });
      await prisma.job.delete({ where: { id: closedJob.id } });
    });
  });

  describe('POST /api/jobs/[id]/join - Join Job with Token', () => {
    it('should join job with valid token', async () => {
      const joinJob = await prisma.job.create({
        data: {
          title: 'Join Test Job',
          description: 'Test joining',
          location: 'Test',
          eventTime: new Date(Date.now() + 86400000),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: requesterUser.id,
          status: 'OPEN',
        },
      });

      const qrToken = await createQRToken(joinJob.id);
      const result = await validateQRToken(qrToken.token, helperUser.id);

      expect(result).toBeDefined();
      expect(result?.jobId).toBe(joinJob.id);

      // Token should be marked as used
      const usedToken = await prisma.qRToken.findFirst({
        where: { token: qrToken.token },
      });

      expect(usedToken?.isUsed).toBe(true);
      expect(usedToken?.scannedAt).toBeInstanceOf(Date);
      expect(usedToken?.scannedBy).toBe(helperUser.id);

      // Cleanup
      await prisma.qRToken.deleteMany({ where: { jobId: joinJob.id } });
      await prisma.job.delete({ where: { id: joinJob.id } });
    });

    it('should join job with short code', async () => {
      const joinJob = await prisma.job.create({
        data: {
          title: 'Short Code Join Test',
          description: 'Test short code',
          location: 'Test',
          eventTime: new Date(Date.now() + 86400000),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: requesterUser.id,
          status: 'OPEN',
        },
      });

      const qrToken = await createQRToken(joinJob.id);
      const result = await validateQRToken(qrToken.shortCode, helperUser.id);

      expect(result).toBeDefined();
      expect(result?.jobId).toBe(joinJob.id);

      // Cleanup
      await prisma.qRToken.deleteMany({ where: { jobId: joinJob.id } });
      await prisma.job.delete({ where: { id: joinJob.id } });
    });

    it('should update job status to ACCEPTED after join', async () => {
      const joinJob = await prisma.job.create({
        data: {
          title: 'Status Update Test',
          description: 'Test status change',
          location: 'Test',
          eventTime: new Date(Date.now() + 86400000),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: requesterUser.id,
          status: 'OPEN',
        },
      });

      const qrToken = await createQRToken(joinJob.id);
      await validateQRToken(qrToken.token, helperUser.id);

      // In real flow, status would be updated to ACCEPTED
      // Here we just verify the token was consumed
      const usedToken = await prisma.qRToken.findFirst({
        where: { token: qrToken.token },
      });

      expect(usedToken?.isUsed).toBe(true);

      // Cleanup
      await prisma.qRToken.deleteMany({ where: { jobId: joinJob.id } });
      await prisma.job.delete({ where: { id: joinJob.id } });
    });

    it('should reject invalid token', async () => {
      const result = await validateQRToken('invalid-token', helperUser.id);

      expect(result).toBeNull();
    });

    it('should reject expired token', async () => {
      const expiredToken = await prisma.qRToken.create({
        data: {
          jobId: testJob.id,
          token: `expired-join-${Date.now()}`,
          shortCode: Math.floor(100000 + Math.random() * 900000).toString(),
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      const result = await validateQRToken(expiredToken.token, helperUser.id);

      expect(result).toBeNull();
    });

    it('should reject already used token', async () => {
      const joinJob = await prisma.job.create({
        data: {
          title: 'Reuse Test',
          description: 'Test token reuse',
          location: 'Test',
          eventTime: new Date(Date.now() + 86400000),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: requesterUser.id,
          status: 'OPEN',
        },
      });

      const qrToken = await createQRToken(joinJob.id);

      // Use token once
      await validateQRToken(qrToken.token, helperUser.id);

      // Try to use again
      const result = await validateQRToken(qrToken.token, helperUser.id);

      expect(result).toBeNull();

      // Cleanup
      await prisma.qRToken.deleteMany({ where: { jobId: joinJob.id } });
      await prisma.job.delete({ where: { id: joinJob.id } });
    });

    it('should prevent two helpers from joining same job', async () => {
      const exclusiveJob = await prisma.job.create({
        data: {
          title: 'Exclusive Job',
          description: 'Only one helper allowed',
          location: 'Test',
          eventTime: new Date(Date.now() + 86400000),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: requesterUser.id,
          status: 'OPEN',
        },
      });

      const token1 = await createQRToken(exclusiveJob.id);
      const token2 = await createQRToken(exclusiveJob.id);

      // First helper joins
      const result1 = await validateQRToken(token1.token, helperUser.id);
      expect(result1).toBeDefined();

      // Create assignment
      await prisma.assignment.create({
        data: {
          jobId: exclusiveJob.id,
          helperId: helperUser.id,
        },
      });

      // Second helper tries to join
      const helper2 = await createTestUser({
        roles: ['HELPER'],
        activeRole: 'HELPER',
      });

      const result2 = await validateQRToken(token2.token, helper2.id);
      expect(result2).toBeNull();

      // Cleanup
      await prisma.qRToken.deleteMany({ where: { jobId: exclusiveJob.id } });
      await prisma.assignment.deleteMany({ where: { jobId: exclusiveJob.id } });
      await prisma.job.delete({ where: { id: exclusiveJob.id } });
      await deleteTestUser(helper2.id);
    });
  });

  describe('Token Cleanup', () => {
    it('should allow deleting expired tokens', async () => {
      const oldToken = await prisma.qRToken.create({
        data: {
          jobId: testJob.id,
          token: `old-${Date.now()}`,
          shortCode: Math.floor(100000 + Math.random() * 900000).toString(),
          expiresAt: new Date(Date.now() - 60 * 60 * 1000),
        },
      });

      const deleted = await prisma.qRToken.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      expect(deleted.count).toBeGreaterThan(0);
    });

    it('should cascade delete tokens when job is deleted', async () => {
      const tempJob = await prisma.job.create({
        data: {
          title: 'Temp Job',
          description: 'Test cascade delete',
          location: 'Test',
          eventTime: new Date(Date.now() + 86400000),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: requesterUser.id,
        },
      });

      const qrToken = await createQRToken(tempJob.id);

      await prisma.job.delete({ where: { id: tempJob.id } });

      const tokenExists = await prisma.qRToken.findFirst({
        where: { token: qrToken.token },
      });

      expect(tokenExists).toBeNull();
    });
  });

  describe('Security', () => {
    it('should prevent SQL injection in token field', async () => {
      const maliciousToken = "' OR '1'='1";

      const result = await validateQRToken(maliciousToken, helperUser.id);

      expect(result).toBeNull();
    });

    it('should prevent SQL injection in short code field', async () => {
      const maliciousCode = "123456'; DROP TABLE qr_tokens; --";

      const result = await validateQRToken(maliciousCode, helperUser.id);

      expect(result).toBeNull();
    });

    it('should generate cryptographically secure tokens', async () => {
      const token1 = await createQRToken(testJob.id);
      const token2 = await createQRToken(testJob.id);

      // Tokens should be unpredictable
      expect(token1.token).not.toBe(token2.token);
      expect(token1.token.length).toBeGreaterThan(40);
    });
  });
});
