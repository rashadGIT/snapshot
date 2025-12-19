/**
 * Submit Job for Review API
 * POST /api/jobs/[id]/submit - Helper submits completed job
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
  const user = await requireRole(authRequest, ['HELPER']);

  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const jobId = params.id;

    // Find job and verify Helper is assigned
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        assignments: true,
        uploads: true,
      },
    });

    if (!job) {
      return notFoundResponse('Job not found');
    }

    // Verify Helper is assigned to this job
    const isAssigned = job.assignments.some((a) => a.helperId === user.id);
    if (!isAssigned) {
      return unauthorizedResponse('Not assigned to this job');
    }

    // Verify job is in correct status (ACCEPTED or IN_PROGRESS)
    if (job.status !== 'ACCEPTED' && job.status !== 'IN_PROGRESS') {
      return badRequestResponse(`Cannot submit job in ${job.status} status`);
    }

    // Verify at least one upload exists
    if (job.uploads.length === 0) {
      return badRequestResponse('Cannot submit job without any uploads');
    }

    // Update job status to IN_REVIEW and set submittedAt timestamp
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'IN_REVIEW',
        submittedAt: new Date(),
      },
    });

    return Response.json({
      message: 'Job submitted for review',
      job: updatedJob,
    });
  } catch (error) {
    logger.error('Failed to submit job:', error);
    return serverErrorResponse();
  }
}
