/**
 * Test Helper for Authentication
 * Utilities for creating test users and mock tokens
 */

import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

export interface TestUser {
  id: string;
  cognitoSub: string;
  email: string;
  name: string;
  roles: UserRole[];
  activeRole: UserRole | null;
}

/**
 * Create a test user in the database
 */
export async function createTestUser(
  overrides: Partial<TestUser> = {}
): Promise<TestUser> {
  const timestamp = Date.now();
  const user = await prisma.user.create({
    data: {
      cognitoSub: overrides.cognitoSub || `test-sub-${timestamp}`,
      email: overrides.email || `test-${timestamp}@example.com`,
      name: overrides.name || 'Test User',
      roles: overrides.roles || ['REQUESTER'],
      activeRole: overrides.activeRole || 'REQUESTER',
      authProvider: 'google',
      verificationStatus: 'verified',
    },
  });

  return user as TestUser;
}

/**
 * Create a test user without a role (for onboarding tests)
 */
export async function createTestUserWithoutRole(): Promise<TestUser> {
  const timestamp = Date.now();
  const user = await prisma.user.create({
    data: {
      cognitoSub: `test-sub-no-role-${timestamp}`,
      email: `test-no-role-${timestamp}@example.com`,
      name: 'Test User Without Role',
      authProvider: 'google',
      verificationStatus: 'verified',
      // No roles or activeRole set
    },
  });

  return user as TestUser;
}

/**
 * Clean up test user
 */
export async function deleteTestUser(userId: string): Promise<void> {
  await prisma.user.delete({ where: { id: userId } });
}

/**
 * Generate a mock JWT token for testing
 * NOTE: This is a mock token that won't pass real JWT verification
 * For integration tests, we'll bypass JWT verification
 */
export function generateMockToken(cognitoSub: string): string {
  // Simple mock token format
  return `mock-token-${cognitoSub}`;
}

/**
 * Create authorization header for tests
 */
export function createAuthHeader(token: string): HeadersInit {
  return {
    'Authorization': `Bearer ${token}`,
  };
}

/**
 * Disconnect prisma client
 */
export async function disconnectTestDb(): Promise<void> {
  await prisma.$disconnect();
}
