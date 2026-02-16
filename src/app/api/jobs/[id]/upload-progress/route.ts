/**
 * Upload Progress API
 * POST /api/jobs/[id]/upload-progress - Broadcast upload progress state
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, unauthorizedResponse, notFoundResponse, serverErrorResponse, badRequestResponse } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import { cookies } from 'next/headers';
import { logger } from '@/lib/utils/logger';
import { broadcastToJob } from '@/lib/websocket/broadcaster';
import { z } from 'zod';

/**
 * Validation schema
 */
const uploadProgressSchema = z.object({
  isUploading: z.boolean(),
});

/**
 * Helper to get authenticated request
 */
async function getAuthRequest(request: NextRequest): Promise<NextRequest> {
  const cookieStore = await cookies();
  const idToken = cookieStore.get('id_token')?.value;
  const headers = new Headers(request.headers);
  if (idToken) {
    headers.set('Authorization', `Bearer ${idToken}`);
  }
  return new NextRequest(request.url, { headers, method: request.method });
}

/**
 * POST /api/jobs/[id]/upload-progress
 * Broadcast upload progress state to other users viewing the job
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authRequest = await getAuthRequest(request);
  const user = await requireRole(authRequest, ['HELPER']);

  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const jobId = params.id;

    // Verify job exists and user has access
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        assignments: {
          where: { userId: user.id },
        },
      },
    });

    if (!job) {
      return notFoundResponse('Job not found');
    }

    // Check if user is helper (only helpers upload)
    const isHelper = job.assignments.length > 0;
    if (!isHelper) {
      return unauthorizedResponse('Only helpers can broadcast upload progress');
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = uploadProgressSchema.safeParse(body);

    if (!validation.success) {
      return badRequestResponse(validation.error.errors[0].message);
    }

    const { isUploading } = validation.data;

    // Broadcast UPLOAD_PROGRESS event
    try {
      await broadcastToJob(jobId, {
        type: 'UPLOAD_PROGRESS',
        payload: {
          jobId,
          userId: user.id,
          userName: user.name || user.email || 'Helper',
          isUploading,
        },
      });
      logger.debug('[Upload Progress API] WebSocket event broadcast successfully');
    } catch (broadcastError) {
      // Don't fail the request if WebSocket broadcast fails
      logger.error('[Upload Progress API] Failed to broadcast WebSocket event:', broadcastError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to broadcast upload progress:', error);
    return serverErrorResponse();
  }
}
