/**
 * Prisma Client Singleton
 * Prevents multiple instances in development due to hot reloading
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/utils/logger';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// TEMPORARY: Hardcoded fallback for DATABASE_URL
// Amplify Lambda environment doesn't receive env vars properly
// Only use in production, not in test/dev environments
if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
  process.env.DATABASE_URL = 'postgresql://postgres:rdShgqzlSNOI7KFgw75yBo1e8@snapspot-db.cwicba7ofk1o.us-east-1.rds.amazonaws.com:5432/postgres';
  logger.info('Using hardcoded DATABASE_URL fallback for production');
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
