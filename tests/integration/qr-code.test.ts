import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * QR Code System Tests
 * Tests QR token generation, expiration, and validation
 */

describe.skip('QR Code System Tests', () => {
  let testUser: any;
  let testJob: any;
  let testQRToken: any;

  beforeAll(async () => {
    testUser = await prisma.user.create({
      data: {
        cognitoSub: 'qr-test-sub',
        email: 'qrtest@example.com',
        name: 'QR Test User',
        roles: ['REQUESTER'],
        activeRole: 'REQUESTER',
      },
    });

    testJob = await prisma.job.create({
      data: {
        title: 'QR Test Job',
        description: 'Test job for QR code testing',
        location: 'Test Location',
        eventTime: new Date(Date.now() + 86400000),
        contentType: 'photos',
        priceTier: 'standard',
        requesterId: testUser.id,
      },
    });
  });

  afterAll(async () => {
    await prisma.qRToken.deleteMany({ where: { jobId: testJob.id } });
    await prisma.job.delete({ where: { id: testJob.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.$disconnect();
  });

  describe('QR Token Generation', () => {
    it('should generate QR token with unique token and shortCode', async () => {
      testQRToken = await prisma.qRToken.create({
        data: {
          jobId: testJob.id,
          token: `token-${Date.now()}`,
          shortCode: Math.floor(100000 + Math.random() * 900000).toString(),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        },
      });

      expect(testQRToken.token).toBeDefined();
      expect(testQRToken.shortCode).toMatch(/^\d{6}$/);
      expect(testQRToken.expiresAt).toBeInstanceOf(Date);
    });

    it('should set expiration to 15 minutes from now', async () => {
      const now = Date.now();
      const expirationTime = new Date(testQRToken.expiresAt).getTime();
      const fifteenMinutes = 15 * 60 * 1000;

      const timeDiff = expirationTime - now;

      expect(timeDiff).toBeGreaterThan(14.9 * 60 * 1000); // At least 14.9 minutes
      expect(timeDiff).toBeLessThan(15.1 * 60 * 1000); // At most 15.1 minutes
    });

    it('should generate 6-digit numeric backup code', async () => {
      expect(testQRToken.shortCode).toMatch(/^\d{6}$/);
      expect(testQRToken.shortCode.length).toBe(6);
    });

    it('should mark token as unused initially', async () => {
      expect(testQRToken.isUsed).toBe(false);
      expect(testQRToken.scannedAt).toBeNull();
      expect(testQRToken.scannedBy).toBeNull();
    });

    it('should ensure shortCode is unique', async () => {
      const existingCode = testQRToken.shortCode;

      // Try to create another token with same shortCode
      await expect(async () => {
        await prisma.qRToken.create({
          data: {
            jobId: testJob.id,
            token: `token-${Date.now()}-2`,
            shortCode: existingCode,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          },
        });
      }).rejects.toThrow();
    });

    it('should ensure token is unique', async () => {
      const existingToken = testQRToken.token;

      // Try to create another token with same token
      await expect(async () => {
        await prisma.qRToken.create({
          data: {
            jobId: testJob.id,
            token: existingToken,
            shortCode: Math.floor(100000 + Math.random() * 900000).toString(),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          },
        });
      }).rejects.toThrow();
    });
  });

  describe('QR Token Validation', () => {
    it('should find valid unexpired token', async () => {
      const token = await prisma.qRToken.findFirst({
        where: {
          token: testQRToken.token,
          isUsed: false,
          expiresAt: { gt: new Date() },
        },
      });

      expect(token).toBeDefined();
      expect(token?.id).toBe(testQRToken.id);
    });

    it('should find valid token by shortCode', async () => {
      const token = await prisma.qRToken.findFirst({
        where: {
          shortCode: testQRToken.shortCode,
          isUsed: false,
          expiresAt: { gt: new Date() },
        },
      });

      expect(token).toBeDefined();
      expect(token?.id).toBe(testQRToken.id);
    });

    it('should reject expired tokens', async () => {
      const expiredToken = await prisma.qRToken.create({
        data: {
          jobId: testJob.id,
          token: `expired-token-${Date.now()}`,
          shortCode: Math.floor(100000 + Math.random() * 900000).toString(),
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        },
      });

      const token = await prisma.qRToken.findFirst({
        where: {
          token: expiredToken.token,
          isUsed: false,
          expiresAt: { gt: new Date() },
        },
      });

      expect(token).toBeNull();

      await prisma.qRToken.delete({ where: { id: expiredToken.id } });
    });

    it('should reject already used tokens', async () => {
      const usedToken = await prisma.qRToken.create({
        data: {
          jobId: testJob.id,
          token: `used-token-${Date.now()}`,
          shortCode: Math.floor(100000 + Math.random() * 900000).toString(),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          isUsed: true,
          scannedAt: new Date(),
          scannedBy: 'helper-123',
        },
      });

      const token = await prisma.qRToken.findFirst({
        where: {
          token: usedToken.token,
          isUsed: false,
        },
      });

      expect(token).toBeNull();

      await prisma.qRToken.delete({ where: { id: usedToken.id } });
    });

    it('should not find non-existent token', async () => {
      const token = await prisma.qRToken.findFirst({
        where: {
          token: 'non-existent-token',
        },
      });

      expect(token).toBeNull();
    });

    it('should not find non-existent shortCode', async () => {
      const token = await prisma.qRToken.findFirst({
        where: {
          shortCode: '000000',
        },
      });

      expect(token).toBeNull();
    });
  });

  describe('QR Token Usage', () => {
    it('should mark token as used after scanning', async () => {
      const helperUserId = 'helper-user-123';

      const updatedToken = await prisma.qRToken.update({
        where: { id: testQRToken.id },
        data: {
          isUsed: true,
          scannedAt: new Date(),
          scannedBy: helperUserId,
        },
      });

      expect(updatedToken.isUsed).toBe(true);
      expect(updatedToken.scannedAt).toBeInstanceOf(Date);
      expect(updatedToken.scannedBy).toBe(helperUserId);
    });

    it('should prevent reusing a token', async () => {
      const token = await prisma.qRToken.findFirst({
        where: {
          id: testQRToken.id,
          isUsed: false,
        },
      });

      expect(token).toBeNull();
    });
  });

  describe('QR Token Cleanup', () => {
    it('should allow deleting expired tokens', async () => {
      const expiredToken = await prisma.qRToken.create({
        data: {
          jobId: testJob.id,
          token: `cleanup-token-${Date.now()}`,
          shortCode: Math.floor(100000 + Math.random() * 900000).toString(),
          expiresAt: new Date(Date.now() - 60 * 60 * 1000), // Expired 1 hour ago
        },
      });

      const deletedCount = await prisma.qRToken.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      expect(deletedCount.count).toBeGreaterThan(0);
    });

    it('should cascade delete QR tokens when job is deleted', async () => {
      const tempJob = await prisma.job.create({
        data: {
          title: 'Temp Job',
          description: 'Test',
          location: 'Test',
          eventTime: new Date(),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: testUser.id,
        },
      });

      const tempToken = await prisma.qRToken.create({
        data: {
          jobId: tempJob.id,
          token: `temp-token-${Date.now()}`,
          shortCode: Math.floor(100000 + Math.random() * 900000).toString(),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      await prisma.job.delete({ where: { id: tempJob.id } });

      const tokenExists = await prisma.qRToken.findUnique({
        where: { id: tempToken.id },
      });

      expect(tokenExists).toBeNull();
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle SQL injection attempts in token', async () => {
      const maliciousToken = "' OR '1'='1";

      const token = await prisma.qRToken.findFirst({
        where: {
          token: maliciousToken,
        },
      });

      expect(token).toBeNull();
    });

    it('should handle SQL injection attempts in shortCode', async () => {
      const maliciousCode = "123456'; DROP TABLE qr_tokens; --";

      const token = await prisma.qRToken.findFirst({
        where: {
          shortCode: maliciousCode,
        },
      });

      expect(token).toBeNull();
    });

    it('should validate shortCode is exactly 6 digits', async () => {
      const invalidCodes = ['12345', '1234567', 'abcdef', '12345a'];

      for (const code of invalidCodes) {
        await expect(async () => {
          await prisma.qRToken.create({
            data: {
              jobId: testJob.id,
              token: `test-${Date.now()}`,
              shortCode: code,
              expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            },
          });
        }).rejects.toThrow();
      }
    });
  });

  describe('Assignment Constraint (1:1)', () => {
    it('should prevent multiple helpers joining same job', async () => {
      const helper1 = await prisma.user.create({
        data: {
          cognitoSub: 'helper1-sub',
          email: 'helper1@test.com',
          roles: ['HELPER'],
          activeRole: 'HELPER',
        },
      });

      const assignment1 = await prisma.assignment.create({
        data: {
          jobId: testJob.id,
          helperId: helper1.id,
        },
      });

      // Try to create second assignment (should fail due to unique jobId constraint)
      const helper2 = await prisma.user.create({
        data: {
          cognitoSub: 'helper2-sub',
          email: 'helper2@test.com',
          roles: ['HELPER'],
          activeRole: 'HELPER',
        },
      });

      await expect(async () => {
        await prisma.assignment.create({
          data: {
            jobId: testJob.id,
            helperId: helper2.id,
          },
        });
      }).rejects.toThrow();

      // Cleanup
      await prisma.assignment.delete({ where: { id: assignment1.id } });
      await prisma.user.delete({ where: { id: helper1.id } });
      await prisma.user.delete({ where: { id: helper2.id } });
    });
  });
});
