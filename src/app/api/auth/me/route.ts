/**
 * Get current user endpoint
 * Returns authenticated user info
 */

import { NextRequest } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth/middleware';
import { cookies } from 'next/headers';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  // Get token from cookie instead of Authorization header for this endpoint
  const cookieStore = await cookies();
  const idToken = cookieStore.get('id_token')?.value;

  if (!idToken) {
    return unauthorizedResponse('Not authenticated');
  }

  // Create request with auth header for middleware
  const headers = new Headers(request.headers);
  headers.set('Authorization', `Bearer ${idToken}`);
  const authRequest = new NextRequest(request.url, {
    headers,
  });

  const auth = await authenticateRequest(authRequest);

  if (!auth) {
    return unauthorizedResponse();
  }

  return Response.json({
    user: {
      id: auth.user.id,
      email: auth.user.email,
      name: auth.user.name,
      roles: auth.user.roles,
      activeRole: auth.user.activeRole,
    },
  });
}

/**
 * Update user role (onboarding only)
 */
export async function PATCH(request: NextRequest) {
  const cookieStore = await cookies();
  const idToken = cookieStore.get('id_token')?.value;

  if (!idToken) {
    return unauthorizedResponse('Not authenticated');
  }

  const headers = new Headers(request.headers);
  headers.set('Authorization', `Bearer ${idToken}`);
  const authRequest = new NextRequest(request.url, {
    headers,
  });

  const auth = await authenticateRequest(authRequest);

  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { role, activeRole } = body;

    // Handle initial role selection (onboarding)
    if (role && !auth.user.activeRole) {
      if (!['REQUESTER', 'HELPER'].includes(role)) {
        return Response.json({ error: 'Invalid role' }, { status: 400 });
      }

      const { prisma } = await import('@/lib/db/prisma');
      const updatedUser = await prisma.user.update({
        where: { id: auth.user.id },
        data: {
          roles: [role],
          activeRole: role,
        },
      });

      return Response.json({
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          roles: updatedUser.roles,
          activeRole: updatedUser.activeRole,
        },
      });
    }

    // Handle active role switching
    if (activeRole) {
      if (!['REQUESTER', 'HELPER'].includes(activeRole)) {
        return Response.json({ error: 'Invalid active role' }, { status: 400 });
      }

      // Check if user has this role
      if (!auth.user.roles.includes(activeRole)) {
        return Response.json({ error: 'You do not have this role' }, { status: 400 });
      }

      const { prisma } = await import('@/lib/db/prisma');
      const updatedUser = await prisma.user.update({
        where: { id: auth.user.id },
        data: { activeRole },
      });

      return Response.json({
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          roles: updatedUser.roles,
          activeRole: updatedUser.activeRole,
        },
      });
    }

    // Handle adding a new role
    if (role && !auth.user.roles.includes(role)) {
      if (!['REQUESTER', 'HELPER'].includes(role)) {
        return Response.json({ error: 'Invalid role' }, { status: 400 });
      }

      const { prisma } = await import('@/lib/db/prisma');
      const updatedUser = await prisma.user.update({
        where: { id: auth.user.id },
        data: {
          roles: [...auth.user.roles, role],
        },
      });

      return Response.json({
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          roles: updatedUser.roles,
          activeRole: updatedUser.activeRole,
        },
      });
    }

    return Response.json({ error: 'No valid update provided' }, { status: 400 });
  } catch (error) {
    logger.error('Role update error:', error);
    return Response.json({ error: 'Failed to update role' }, { status: 500 });
  }
}
