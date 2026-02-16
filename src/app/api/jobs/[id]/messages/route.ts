/**
 * Messages API
 * GET /api/jobs/[id]/messages - Get all messages for a job
 * POST /api/jobs/[id]/messages - Create a new message
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse, notFoundResponse, serverErrorResponse, badRequestResponse } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import { cookies } from 'next/headers';
import { logger } from '@/lib/utils/logger';
import { broadcastToJob } from '@/lib/websocket/broadcaster';
import { z } from 'zod';

/**
 * Validation schema for message creation
 */
const createMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(5000, 'Message too long'),
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
 * GET /api/jobs/[id]/messages
 * Retrieve all messages for a job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authRequest = await getAuthRequest(request);
  const user = await requireAuth(authRequest);

  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const jobId = params.id;

    // Verify job exists and user has access (is requester or helper)
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

    // Check if user is requester or helper
    const isRequester = job.requesterId === user.id;
    const isHelper = job.assignments.length > 0;

    if (!isRequester && !isHelper) {
      return unauthorizedResponse('Not authorized to view messages for this job');
    }

    // Fetch messages with user information
    const messages = await prisma.message.findMany({
      where: { jobId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return NextResponse.json({ messages });
  } catch (error) {
    logger.error('Failed to fetch messages:', error);
    return serverErrorResponse();
  }
}

/**
 * POST /api/jobs/[id]/messages
 * Create a new message in a job
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authRequest = await getAuthRequest(request);
  const user = await requireAuth(authRequest);

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

    // Check if user is requester or helper
    const isRequester = job.requesterId === user.id;
    const isHelper = job.assignments.length > 0;

    if (!isRequester && !isHelper) {
      return unauthorizedResponse('Not authorized to send messages in this job');
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = createMessageSchema.safeParse(body);

    if (!validation.success) {
      return badRequestResponse(validation.error.errors[0].message);
    }

    const { content } = validation.data;

    // Create message
    const message = await prisma.message.create({
      data: {
        jobId,
        userId: user.id,
        content,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Broadcast MESSAGE_CREATED event to all connections in this job
    try {
      await broadcastToJob(jobId, {
        type: 'MESSAGE_CREATED',
        payload: {
          jobId,
          message: {
            id: message.id,
            content: message.content,
            userId: message.userId,
            userName: message.user.name || message.user.email || 'Unknown',
            createdAt: message.createdAt.toISOString(),
          },
        },
      });
      logger.debug('[Messages API] WebSocket event broadcast successfully');
    } catch (broadcastError) {
      // Don't fail the request if WebSocket broadcast fails
      logger.error('[Messages API] Failed to broadcast WebSocket event:', broadcastError);
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create message:', error);
    return serverErrorResponse();
  }
}
