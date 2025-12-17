import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Performance & Load Testing
 * Tests system performance under various load conditions
 */

describe('Performance Tests', () => {
  let testUsers: any[] = [];
  let testJobs: any[] = [];

  beforeAll(async () => {
    // Create test users
    for (let i = 0; i < 5; i++) {
      const user = await prisma.user.create({
        data: {
          cognitoSub: `perf-test-${i}-${Date.now()}`,
          email: `perftest${i}-${Date.now()}@test.com`,
          roles: ['REQUESTER', 'HELPER'],
          activeRole: 'REQUESTER',
        },
      });
      testUsers.push(user);
    }

    // Create test jobs
    for (let i = 0; i < 20; i++) {
      const job = await prisma.job.create({
        data: {
          title: `Performance Test Job ${i}`,
          description: 'Test job for performance testing',
          location: 'Test Location',
          eventTime: new Date(Date.now() + 86400000),
          contentType: i % 2 === 0 ? 'photos' : 'video',
          priceTier: ['basic', 'standard', 'premium'][i % 3] as any,
          requesterId: testUsers[i % testUsers.length].id,
        },
      });
      testJobs.push(job);
    }
  });

  afterAll(async () => {
    // Cleanup
    await prisma.upload.deleteMany({
      where: { jobId: { in: testJobs.map(j => j.id) } },
    });
    await prisma.assignment.deleteMany({
      where: { jobId: { in: testJobs.map(j => j.id) } },
    });
    await prisma.job.deleteMany({
      where: { id: { in: testJobs.map(j => j.id) } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: testUsers.map(u => u.id) } },
    });
    await prisma.$disconnect();
  });

  describe('Database Query Performance', () => {
    it('should fetch job list within 100ms', async () => {
      const startTime = performance.now();

      const jobs = await prisma.job.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
      });

      const duration = performance.now() - startTime;

      expect(jobs.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // 100ms
    });

    it('should fetch job with relations within 150ms', async () => {
      const startTime = performance.now();

      const job = await prisma.job.findUnique({
        where: { id: testJobs[0].id },
        include: {
          requester: true,
          assignments: {
            include: {
              helper: true,
            },
          },
          uploads: true,
        },
      });

      const duration = performance.now() - startTime;

      expect(job).toBeDefined();
      expect(duration).toBeLessThan(150); // 150ms
    });

    it('should handle complex queries efficiently', async () => {
      const startTime = performance.now();

      const jobs = await prisma.job.findMany({
        where: {
          AND: [
            { status: { in: ['OPEN', 'ACCEPTED', 'IN_PROGRESS'] } },
            { eventTime: { gte: new Date() } },
          ],
        },
        include: {
          requester: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              uploads: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(200); // 200ms
    });

    it('should aggregate data efficiently', async () => {
      const startTime = performance.now();

      const stats = await prisma.job.groupBy({
        by: ['status'],
        _count: {
          id: true,
        },
      });

      const duration = performance.now() - startTime;

      expect(stats.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // 100ms
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle 10 concurrent reads', async () => {
      const startTime = performance.now();

      const promises = Array.from({ length: 10 }, () =>
        prisma.job.findMany({
          take: 10,
        })
      );

      const results = await Promise.all(promises);

      const duration = performance.now() - startTime;

      expect(results).toHaveLength(10);
      expect(duration).toBeLessThan(500); // 500ms for 10 concurrent queries
    });

    it('should handle 20 concurrent writes', async () => {
      const startTime = performance.now();

      const promises = Array.from({ length: 20 }, (_, i) =>
        prisma.job.create({
          data: {
            title: `Concurrent Write Test ${i}`,
            description: 'Test',
            location: 'Test',
            eventTime: new Date(),
            contentType: 'photos',
            priceTier: 'basic',
            requesterId: testUsers[0].id,
          },
        })
      );

      const jobs = await Promise.all(promises);

      const duration = performance.now() - startTime;

      expect(jobs).toHaveLength(20);
      expect(duration).toBeLessThan(1000); // 1 second for 20 concurrent writes

      // Cleanup
      await prisma.job.deleteMany({
        where: { id: { in: jobs.map(j => j.id) } },
      });
    });

    it('should handle mixed read/write operations', async () => {
      const startTime = performance.now();

      const operations = [
        // 5 reads
        ...Array.from({ length: 5 }, () => prisma.job.findMany({ take: 10 })),
        // 5 writes
        ...Array.from({ length: 5 }, (_, i) =>
          prisma.job.create({
            data: {
              title: `Mixed Op Test ${i}`,
              description: 'Test',
              location: 'Test',
              eventTime: new Date(),
              contentType: 'photos',
              priceTier: 'basic',
              requesterId: testUsers[0].id,
            },
          })
        ),
      ];

      const results = await Promise.all(operations);

      const duration = performance.now() - startTime;

      expect(results).toHaveLength(10);
      expect(duration).toBeLessThan(1000); // 1 second

      // Cleanup created jobs (last 5 results)
      const createdJobs = results.slice(5) as any[];
      await prisma.job.deleteMany({
        where: { id: { in: createdJobs.map(j => j.id) } },
      });
    });
  });

  describe('Pagination Performance', () => {
    it('should paginate efficiently through large datasets', async () => {
      const pageSize = 10;
      const totalPages = 5;
      const timings: number[] = [];

      for (let page = 0; page < totalPages; page++) {
        const startTime = performance.now();

        await prisma.job.findMany({
          take: pageSize,
          skip: page * pageSize,
          orderBy: { createdAt: 'desc' },
        });

        const duration = performance.now() - startTime;
        timings.push(duration);
      }

      // Each page should load in under 100ms
      timings.forEach(timing => {
        expect(timing).toBeLessThan(100);
      });

      // Average should be under 50ms
      const average = timings.reduce((a, b) => a + b, 0) / timings.length;
      expect(average).toBeLessThan(50);
    });

    it('should use cursor-based pagination efficiently', async () => {
      const pageSize = 10;
      let cursor: string | undefined;
      const timings: number[] = [];

      for (let i = 0; i < 3; i++) {
        const startTime = performance.now();

        const jobs = await prisma.job.findMany({
          take: pageSize,
          ...(cursor && {
            cursor: { id: cursor },
            skip: 1,
          }),
          orderBy: { createdAt: 'desc' },
        });

        const duration = performance.now() - startTime;
        timings.push(duration);

        if (jobs.length > 0) {
          cursor = jobs[jobs.length - 1].id;
        }
      }

      // Cursor-based pagination should be consistently fast
      timings.forEach(timing => {
        expect(timing).toBeLessThan(100);
      });
    });
  });

  describe('Bulk Operations Performance', () => {
    it('should create multiple records efficiently', async () => {
      const startTime = performance.now();

      const uploads = await prisma.upload.createMany({
        data: Array.from({ length: 50 }, (_, i) => ({
          jobId: testJobs[0].id,
          uploadedBy: testUsers[0].id,
          s3Key: `bulk/photo-${i}.jpg`,
          s3Bucket: 'test-bucket',
          fileName: `photo-${i}.jpg`,
          fileType: 'image/jpeg',
          fileSize: 1024 * (i + 1),
        })),
      });

      const duration = performance.now() - startTime;

      expect(uploads.count).toBe(50);
      expect(duration).toBeLessThan(500); // 500ms for 50 records

      // Cleanup
      await prisma.upload.deleteMany({
        where: { jobId: testJobs[0].id },
      });
    });

    it('should update multiple records efficiently', async () => {
      // Create test uploads
      await prisma.upload.createMany({
        data: Array.from({ length: 20 }, (_, i) => ({
          jobId: testJobs[0].id,
          uploadedBy: testUsers[0].id,
          s3Key: `bulk-update/photo-${i}.jpg`,
          s3Bucket: 'test-bucket',
          fileName: `photo-${i}.jpg`,
          fileType: 'image/jpeg',
          fileSize: 1024,
        })),
      });

      const startTime = performance.now();

      const result = await prisma.upload.updateMany({
        where: {
          jobId: testJobs[0].id,
          s3Key: { startsWith: 'bulk-update/' },
        },
        data: {
          fileSize: 2048,
        },
      });

      const duration = performance.now() - startTime;

      expect(result.count).toBe(20);
      expect(duration).toBeLessThan(200); // 200ms

      // Cleanup
      await prisma.upload.deleteMany({
        where: { jobId: testJobs[0].id },
      });
    });

    it('should delete multiple records efficiently', async () => {
      // Create test data
      await prisma.upload.createMany({
        data: Array.from({ length: 30 }, (_, i) => ({
          jobId: testJobs[0].id,
          uploadedBy: testUsers[0].id,
          s3Key: `bulk-delete/photo-${i}.jpg`,
          s3Bucket: 'test-bucket',
          fileName: `photo-${i}.jpg`,
          fileType: 'image/jpeg',
          fileSize: 1024,
        })),
      });

      const startTime = performance.now();

      const result = await prisma.upload.deleteMany({
        where: {
          jobId: testJobs[0].id,
          s3Key: { startsWith: 'bulk-delete/' },
        },
      });

      const duration = performance.now() - startTime;

      expect(result.count).toBe(30);
      expect(duration).toBeLessThan(200); // 200ms
    });
  });

  describe('Memory Usage', () => {
    it('should handle large result sets without memory issues', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Fetch large dataset
      const jobs = await prisma.job.findMany({
        take: 1000,
      });

      const afterFetchMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = afterFetchMemory - initialMemory;

      // Should not use excessive memory (< 50MB for 1000 records)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should not leak memory on repeated queries', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Run 100 queries
      for (let i = 0; i < 100; i++) {
        await prisma.job.findMany({ take: 10 });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory should not grow significantly (< 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Index Utilization', () => {
    it('should use index for status queries', async () => {
      const startTime = performance.now();

      const jobs = await prisma.job.findMany({
        where: { status: 'OPEN' },
        take: 100,
      });

      const duration = performance.now() - startTime;

      // Should be very fast due to index
      expect(duration).toBeLessThan(50); // 50ms
    });

    it('should use index for foreign key lookups', async () => {
      const startTime = performance.now();

      const jobs = await prisma.job.findMany({
        where: { requesterId: testUsers[0].id },
      });

      const duration = performance.now() - startTime;

      // Should be very fast due to foreign key index
      expect(duration).toBeLessThan(50); // 50ms
    });

    it('should use composite index for complex queries', async () => {
      const startTime = performance.now();

      const jobs = await prisma.job.findMany({
        where: {
          status: 'OPEN',
          eventTime: { gte: new Date() },
        },
        take: 100,
      });

      const duration = performance.now() - startTime;

      // Should be reasonably fast
      expect(duration).toBeLessThan(100); // 100ms
    });
  });

  describe('Response Time Consistency', () => {
    it('should have consistent response times for same query', async () => {
      const timings: number[] = [];

      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();

        await prisma.job.findMany({
          where: { status: 'OPEN' },
          take: 20,
        });

        const duration = performance.now() - startTime;
        timings.push(duration);
      }

      const average = timings.reduce((a, b) => a + b, 0) / timings.length;
      const variance = timings.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / timings.length;
      const standardDeviation = Math.sqrt(variance);

      // Standard deviation should be low (consistent performance)
      expect(standardDeviation).toBeLessThan(20); // 20ms std dev
    });
  });

  describe('N+1 Query Prevention', () => {
    it('should avoid N+1 queries when fetching related data', async () => {
      const startTime = performance.now();

      // Using include should make 1 query, not N+1
      const jobs = await prisma.job.findMany({
        where: { requesterId: testUsers[0].id },
        include: {
          requester: true,
          uploads: true,
        },
        take: 10,
      });

      const duration = performance.now() - startTime;

      // Should be fast even with relations
      expect(duration).toBeLessThan(200); // 200ms
    });

    it('should batch related queries efficiently', async () => {
      const startTime = performance.now();

      const jobs = await prisma.job.findMany({
        take: 5,
        include: {
          requester: true,
          assignments: {
            include: {
              helper: true,
            },
          },
          uploads: true,
          _count: {
            select: {
              uploads: true,
              messages: true,
            },
          },
        },
      });

      const duration = performance.now() - startTime;

      // Should handle complex includes efficiently
      expect(duration).toBeLessThan(300); // 300ms
    });
  });
});
