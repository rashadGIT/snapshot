/**
 * Authentication Middleware
 * Server-side authentication helpers for Next.js route handlers
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyCognitoToken, extractBearerToken, type CognitoTokenPayload } from './jwt';
import type { User, UserRole } from '@prisma/client';

export interface AuthenticatedRequest {
  user: User;
  token: CognitoTokenPayload;
}

/**
 * Authenticate request and return user
 * Verifies JWT, ensures user exists in DB with a role
 * Returns null if authentication fails
 */
export async function authenticateRequest(
  request: NextRequest,
): Promise<AuthenticatedRequest | null> {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('authorization');
    const token = extractBearerToken(authHeader);

    if (!token) {
      return null;
    }

    // Verify JWT
    const payload = await verifyCognitoToken(token);

    // Find or create user in database
    let user = await prisma.user.findUnique({
      where: { cognitoSub: payload.sub },
    });

    if (!user) {
      // First-time login: create user record without role
      user = await prisma.user.create({
        data: {
          cognitoSub: payload.sub,
          email: payload.email || '',
          name: payload.name || payload['cognito:username'] || 'Unknown',
          authProvider: 'google',
          verificationStatus: 'verified',
          // role is null - user must complete onboarding
        },
      });
    }

    return { user, token: payload };
  } catch (error) {
    console.error('Authentication failed:', error);
    return null;
  }
}

/**
 * Require authentication with specific role
 * Returns user if authenticated and authorized, otherwise null
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: UserRole[],
): Promise<User | null> {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return null;
  }

  // User must have completed onboarding (role set)
  if (!auth.user.role) {
    return null;
  }

  // Check if user has required role
  if (!allowedRoles.includes(auth.user.role)) {
    return null;
  }

  return auth.user;
}

/**
 * Create unauthorized response
 */
export function unauthorizedResponse(message: string = 'Unauthorized') {
  return Response.json({ error: message }, { status: 401 });
}

/**
 * Create forbidden response
 */
export function forbiddenResponse(message: string = 'Forbidden') {
  return Response.json({ error: message }, { status: 403 });
}

/**
 * Create bad request response
 */
export function badRequestResponse(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

/**
 * Create not found response
 */
export function notFoundResponse(message: string = 'Not found') {
  return Response.json({ error: message }, { status: 404 });
}

/**
 * Create server error response
 */
export function serverErrorResponse(message: string = 'Internal server error') {
  return Response.json({ error: message }, { status: 500 });
}
