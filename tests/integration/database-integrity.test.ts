import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Database Integrity Tests
 * Tests transaction handling, concurrent operations, and data consistency
 */

describe.skip('Database Integrity Tests', () => {
  let testUser: any;
  let testJob: any;

  beforeAll(async () => {
    testUser = await prisma.user.create({
      data: {
        cognitoSub: `db-integrity-${Date.now()}`,
        email: `db-integrity-${Date.now()}@test.com`,
        roles: ['REQUESTER'],
        activeRole: 'REQUESTER',
      },
    });

    testJob = await prisma.job.create({
      data: {
        title: 'DB Integrity Test Job',
        description: 'Test',
        location: 'Test',
        eventTime: new Date(Date.now() + 86400000),
        contentType: 'photos',
        priceTier: 'basic',
        requesterId: testUser.id,
      },
    });
  });

  afterAll(async () => {
    await prisma.job.deleteMany({ where: { requesterId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.$disconnect();
  });

  describe('Transaction Handling', () => {
    it('should rollback transaction on error', async () => {
      const initialJobCount = await prisma.job.count();

      try {
        await prisma.$transaction(async (tx) => {
          // Create a job
          const job = await tx.job.create({
            data: {
              title: 'Transaction Test',
              description: 'Test',
              location: 'Test',
              eventTime: new Date(),
              contentType: 'photos',
              priceTier: 'basic',
              requesterId: testUser.id,
            },
          });

          // This should fail and rollback the entire transaction
          await tx.job.create({
            data: {
              title: 'This will fail',
              description: 'Test',
              location: 'Test',
              eventTime: new Date(),
              contentType: 'photos',
              priceTier: 'basic',
              requesterId: '00000000-0000-0000-0000-000000000000', // Invalid user ID
            },
          });
        });
      } catch (error) {
        // Expected to fail
      }

      const finalJobCount = await prisma.job.count();
      expect(finalJobCount).toBe(initialJobCount);
    });

    it('should commit transaction on success', async () => {
      const initialJobCount = await prisma.job.count();

      const jobs = await prisma.$transaction(async (tx) => {
        const job1 = await tx.job.create({
          data: {
            title: 'Transaction Success 1',
            description: 'Test',
            location: 'Test',
            eventTime: new Date(),
            contentType: 'photos',
            priceTier: 'basic',
            requesterId: testUser.id,
          },
        });

        const job2 = await tx.job.create({
          data: {
            title: 'Transaction Success 2',
            description: 'Test',
            location: 'Test',
            eventTime: new Date(),
            contentType: 'photos',
            priceTier: 'basic',
            requesterId: testUser.id,
          },
        });

        return [job1, job2];
      });

      const finalJobCount = await prisma.job.count();
      expect(finalJobCount).toBe(initialJobCount + 2);

      // Cleanup
      await prisma.job.deleteMany({
        where: { id: { in: jobs.map(j => j.id) } },
      });
    });

    it('should handle nested transactions correctly', async () => {
      const result = await prisma.$transaction(async (tx) => {
        const job = await tx.job.create({
          data: {
            title: 'Nested Transaction Test',
            description: 'Test',
            location: 'Test',
            eventTime: new Date(),
            contentType: 'photos',
            priceTier: 'basic',
            requesterId: testUser.id,
          },
        });

        const assignment = await tx.assignment.create({
          data: {
            jobId: job.id,
            helperId: testUser.id,
          },
        });

        return { job, assignment };
      });

      expect(result.job.id).toBeDefined();
      expect(result.assignment.jobId).toBe(result.job.id);

      // Cleanup
      await prisma.assignment.delete({ where: { id: result.assignment.id } });
      await prisma.job.delete({ where: { id: result.job.id } });
    });
  });

  describe('Foreign Key Constraints', () => {
    it('should enforce foreign key constraint on job.requesterId', async () => {
      await expect(async () => {
        await prisma.job.create({
          data: {
            title: 'Invalid Requester',
            description: 'Test',
            location: 'Test',
            eventTime: new Date(),
            contentType: 'photos',
            priceTier: 'basic',
            requesterId: '00000000-0000-0000-0000-000000000000',
          },
        });
      }).rejects.toThrow();
    });

    it('should enforce foreign key constraint on assignment.helperId', async () => {
      await expect(async () => {
        await prisma.assignment.create({
          data: {
            jobId: testJob.id,
            helperId: '00000000-0000-0000-0000-000000000000',
          },
        });
      }).rejects.toThrow();
    });

    it('should enforce foreign key constraint on upload.jobId', async () => {
      await expect(async () => {
        await prisma.upload.create({
          data: {
            jobId: '00000000-0000-0000-0000-000000000000',
            uploadedBy: testUser.id,
            s3Key: 'test/photo.jpg',
            s3Bucket: 'bucket',
            fileName: 'photo.jpg',
            fileType: 'image/jpeg',
            fileSize: 1024,
          },
        });
      }).rejects.toThrow();
    });

    it('should cascade delete uploads when job is deleted', async () => {
      const job = await prisma.job.create({
        data: {
          title: 'Cascade Test',
          description: 'Test',
          location: 'Test',
          eventTime: new Date(),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: testUser.id,
        },
      });

      const upload = await prisma.upload.create({
        data: {
          jobId: job.id,
          uploadedBy: testUser.id,
          s3Key: 'test/cascade.jpg',
          s3Bucket: 'bucket',
          fileName: 'cascade.jpg',
          fileType: 'image/jpeg',
          fileSize: 1024,
        },
      });

      await prisma.job.delete({ where: { id: job.id } });

      const uploadExists = await prisma.upload.findUnique({
        where: { id: upload.id },
      });

      expect(uploadExists).toBeNull();
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique email constraint', async () => {
      const email = `unique-${Date.now()}@test.com`;

      await prisma.user.create({
        data: {
          cognitoSub: `unique-1-${Date.now()}`,
          email: email,
          roles: ['REQUESTER'],
          activeRole: 'REQUESTER',
        },
      });

      await expect(async () => {
        await prisma.user.create({
          data: {
            cognitoSub: `unique-2-${Date.now()}`,
            email: email, // Duplicate email
            roles: ['REQUESTER'],
            activeRole: 'REQUESTER',
          },
        });
      }).rejects.toThrow();

      // Cleanup
      await prisma.user.delete({ where: { email } });
    });

    it('should enforce unique cognitoSub constraint', async () => {
      const cognitoSub = `unique-sub-${Date.now()}`;

      await prisma.user.create({
        data: {
          cognitoSub: cognitoSub,
          email: `unique-1-${Date.now()}@test.com`,
          roles: ['REQUESTER'],
          activeRole: 'REQUESTER',
        },
      });

      await expect(async () => {
        await prisma.user.create({
          data: {
            cognitoSub: cognitoSub, // Duplicate cognitoSub
            email: `unique-2-${Date.now()}@test.com`,
            roles: ['REQUESTER'],
            activeRole: 'REQUESTER',
          },
        });
      }).rejects.toThrow();

      // Cleanup
      await prisma.user.delete({ where: { cognitoSub } });
    });

    it('should enforce unique jobId in assignments', async () => {
      const helper = await prisma.user.create({
        data: {
          cognitoSub: `helper-${Date.now()}`,
          email: `helper-${Date.now()}@test.com`,
          roles: ['HELPER'],
          activeRole: 'HELPER',
        },
      });

      const assignment = await prisma.assignment.create({
        data: {
          jobId: testJob.id,
          helperId: helper.id,
        },
      });

      // Try to create another assignment for same job
      const helper2 = await prisma.user.create({
        data: {
          cognitoSub: `helper2-${Date.now()}`,
          email: `helper2-${Date.now()}@test.com`,
          roles: ['HELPER'],
          activeRole: 'HELPER',
        },
      });

      await expect(async () => {
        await prisma.assignment.create({
          data: {
            jobId: testJob.id, // Same job
            helperId: helper2.id,
          },
        });
      }).rejects.toThrow();

      // Cleanup
      await prisma.assignment.delete({ where: { id: assignment.id } });
      await prisma.user.delete({ where: { id: helper.id } });
      await prisma.user.delete({ where: { id: helper2.id } });
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent job creations', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        prisma.job.create({
          data: {
            title: `Concurrent Job ${i}`,
            description: 'Test',
            location: 'Test',
            eventTime: new Date(),
            contentType: 'photos',
            priceTier: 'basic',
            requesterId: testUser.id,
          },
        })
      );

      const jobs = await Promise.all(promises);

      expect(jobs).toHaveLength(10);
      expect(new Set(jobs.map(j => j.id)).size).toBe(10); // All unique IDs

      // Cleanup
      await prisma.job.deleteMany({
        where: { id: { in: jobs.map(j => j.id) } },
      });
    });

    it('should handle concurrent status updates correctly', async () => {
      const job = await prisma.job.create({
        data: {
          title: 'Concurrent Status Test',
          description: 'Test',
          location: 'Test',
          eventTime: new Date(),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: testUser.id,
        },
      });

      // Multiple concurrent updates
      const updates = [
        prisma.job.update({
          where: { id: job.id },
          data: { status: 'ACCEPTED' },
        }),
        prisma.job.update({
          where: { id: job.id },
          data: { status: 'CANCELLED' },
        }),
      ];

      await Promise.all(updates);

      const finalJob = await prisma.job.findUnique({
        where: { id: job.id },
      });

      // One of the updates should win
      expect(['ACCEPTED', 'CANCELLED']).toContain(finalJob?.status);

      // Cleanup
      await prisma.job.delete({ where: { id: job.id } });
    });

    it('should handle concurrent upload creations', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        prisma.upload.create({
          data: {
            jobId: testJob.id,
            uploadedBy: testUser.id,
            s3Key: `concurrent/photo-${i}.jpg`,
            s3Bucket: 'bucket',
            fileName: `photo-${i}.jpg`,
            fileType: 'image/jpeg',
            fileSize: 1024 * (i + 1),
          },
        })
      );

      const uploads = await Promise.all(promises);

      expect(uploads).toHaveLength(5);
      expect(new Set(uploads.map(u => u.id)).size).toBe(5);

      // Cleanup
      await prisma.upload.deleteMany({
        where: { id: { in: uploads.map(u => u.id) } },
      });
    });
  });

  describe('Index Performance', () => {
    it('should efficiently query jobs by status', async () => {
      const startTime = Date.now();

      await prisma.job.findMany({
        where: { status: 'OPEN' },
        take: 100,
      });

      const duration = Date.now() - startTime;

      // Should be fast due to index on status
      expect(duration).toBeLessThan(100); // 100ms
    });

    it('should efficiently query jobs by requesterId', async () => {
      const startTime = Date.now();

      await prisma.job.findMany({
        where: { requesterId: testUser.id },
      });

      const duration = Date.now() - startTime;

      // Should be fast due to foreign key index
      expect(duration).toBeLessThan(100);
    });

    it('should efficiently query uploads by jobId', async () => {
      const startTime = Date.now();

      await prisma.upload.findMany({
        where: { jobId: testJob.id },
      });

      const duration = Date.now() - startTime;

      // Should be fast due to foreign key index
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Data Validation', () => {
    it('should validate job status enum', async () => {
      await expect(async () => {
        await prisma.$executeRaw`
          INSERT INTO jobs (id, title, description, location, event_time, content_type, price_tier, status, requester_id)
          VALUES (gen_random_uuid(), 'Test', 'Test', 'Test', NOW(), 'photos', 'basic', 'INVALID_STATUS', ${testUser.id})
        `;
      }).rejects.toThrow();
    });

    it('should validate content_type enum', async () => {
      await expect(async () => {
        await prisma.job.create({
          data: {
            title: 'Invalid Content Type',
            description: 'Test',
            location: 'Test',
            eventTime: new Date(),
            contentType: 'invalid' as any,
            priceTier: 'basic',
            requesterId: testUser.id,
          },
        });
      }).rejects.toThrow();
    });

    it('should validate price_tier enum', async () => {
      await expect(async () => {
        await prisma.job.create({
          data: {
            title: 'Invalid Price Tier',
            description: 'Test',
            location: 'Test',
            eventTime: new Date(),
            contentType: 'photos',
            priceTier: 'invalid' as any,
            requesterId: testUser.id,
          },
        });
      }).rejects.toThrow();
    });
  });

  describe('Timestamp Management', () => {
    it('should automatically set createdAt on creation', async () => {
      const before = new Date();

      const job = await prisma.job.create({
        data: {
          title: 'Timestamp Test',
          description: 'Test',
          location: 'Test',
          eventTime: new Date(),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: testUser.id,
        },
      });

      const after = new Date();

      expect(job.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(job.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());

      // Cleanup
      await prisma.job.delete({ where: { id: job.id } });
    });

    it('should automatically update updatedAt on modification', async () => {
      const job = await prisma.job.create({
        data: {
          title: 'Update Timestamp Test',
          description: 'Test',
          location: 'Test',
          eventTime: new Date(),
          contentType: 'photos',
          priceTier: 'basic',
          requesterId: testUser.id,
        },
      });

      const originalUpdatedAt = job.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const updatedJob = await prisma.job.update({
        where: { id: job.id },
        data: { title: 'Updated Title' },
      });

      expect(updatedJob.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());

      // Cleanup
      await prisma.job.delete({ where: { id: job.id } });
    });
  });

  describe('Query Optimization', () => {
    it('should use eager loading for related data', async () => {
      const startTime = Date.now();

      const jobs = await prisma.job.findMany({
        where: { requesterId: testUser.id },
        include: {
          requester: true,
          assignments: {
            include: {
              helper: true,
            },
          },
          uploads: true,
        },
        take: 10,
      });

      const duration = Date.now() - startTime;

      // Should be reasonably fast even with includes
      expect(duration).toBeLessThan(500); // 500ms
    });

    it('should paginate large result sets efficiently', async () => {
      const startTime = Date.now();

      const page1 = await prisma.job.findMany({
        take: 20,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });

      const page2 = await prisma.job.findMany({
        take: 20,
        skip: 20,
        orderBy: { createdAt: 'desc' },
      });

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200); // 200ms for both queries
    });
  });
});
