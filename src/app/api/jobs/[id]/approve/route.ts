/**
 * Approve Job API
 * POST /api/jobs/[id]/approve - Requester approves completed job
 */

import { NextRequest } from 'next/server';
import { requireRole, unauthorizedResponse, notFoundResponse, badRequestResponse, serverErrorResponse } from '@/lib/auth/middleware';
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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authRequest = await getAuthRequest(request);
  const user = await requireRole(authRequest, ['REQUESTER']);

  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const jobId = params.id;

    // Find job and verify Requester owns it
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return notFoundResponse('Job not found');
    }

    // Verify Requester owns this job
    if (job.requesterId !== user.id) {
      return unauthorizedResponse('Not your job');
    }

    // Verify job is in IN_REVIEW status
    if (job.status !== 'IN_REVIEW') {
      return badRequestResponse(`Cannot approve job in ${job.status} status`);
    }

    // Update job status to COMPLETED and set completedAt timestamp
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    return Response.json({
      message: 'Job approved',
      job: updatedJob,
    });
  } catch (error) {
    logger.error('Failed to approve job:', error);
    return serverErrorResponse();
  }
}
