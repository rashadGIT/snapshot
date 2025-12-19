/**
 * Single Job API
 * GET /api/jobs/[id] - Get job details
 */

import { NextRequest } from 'next/server';
import { requireRole, unauthorizedResponse, notFoundResponse, serverErrorResponse } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import { cookies } from 'next/headers';
import { logger } from '@/lib/utils/logger';

async function getAuthRequest(request: NextRequest): Promise<NextRequest> {
  const cookieStore = await cookies();
  const idToken = cookieStore.get('id_token')?.value;
  const headers = new Headers(request.headers);
  if (idToken) {
    headers.set('Authorization', `Bearer ${idToken}`);
  }
  return new NextRequest(request.url, { headers, method: request.method });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authRequest = await getAuthRequest(request);
  const user = await requireRole(authRequest, ['REQUESTER', 'HELPER']);

  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const jobId = params.id;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignments: {
          include: {
            helper: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        uploads: true,
        messages: {
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
        },
      },
    });

    if (!job) {
      return notFoundResponse('Job not found');
    }

    // Check access: Requester owns job OR Helper is assigned
    const isRequester = job.requesterId === user.id;
    const isAssignedHelper = job.assignments.some((a) => a.helperId === user.id);

    if (!isRequester && !isAssignedHelper) {
      return unauthorizedResponse('No access to this job');
    }

    return Response.json({ job });
  } catch (error) {
    logger.error('Failed to fetch job:', error);
    return serverErrorResponse();
  }
}
