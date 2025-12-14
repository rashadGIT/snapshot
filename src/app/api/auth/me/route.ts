/**
 * Get current user endpoint
 * Returns authenticated user info
 */

import { NextRequest } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth/middleware';
import { cookies } from 'next/headers';

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
      role: auth.user.role,
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

  // Only allow role update if user has no role (onboarding)
  if (auth.user.role) {
    return Response.json({ error: 'Role already set' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { role } = body;

    if (!role || !['REQUESTER', 'HELPER'].includes(role)) {
      return Response.json({ error: 'Invalid role' }, { status: 400 });
    }

    const { prisma } = await import('@/lib/db/prisma');
    const updatedUser = await prisma.user.update({
      where: { id: auth.user.id },
      data: { role },
    });

    return Response.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error('Role update error:', error);
    return Response.json({ error: 'Failed to update role' }, { status: 500 });
  }
}
