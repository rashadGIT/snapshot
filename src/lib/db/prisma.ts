/**
 * Prisma Client Singleton
 * Prevents multiple instances in development due to hot reloading
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// TEMPORARY: Inject DATABASE_URL at runtime for Amplify
// This works around the Lambda env var propagation issue
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;

  if (!url) {
    // If DATABASE_URL is not set, use hardcoded value for Amplify deployment
    const hardcodedUrl = 'postgresql://snapspot:rdShgqzlSNOI7KFgw75yBo1e8@snapspot-db.cwicba7ofk1o.us-east-1.rds.amazonaws.com:5432/postgres';
    console.log('DATABASE_URL not found in env, using hardcoded value');
    return hardcodedUrl;
  }

  return url;
}

// Ensure DATABASE_URL is set before instantiating Prisma
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = getDatabaseUrl();
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
