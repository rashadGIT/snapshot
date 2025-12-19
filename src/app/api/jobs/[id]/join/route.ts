/**
 * Join Job API
 * POST /api/jobs/[id]/join - Helper joins job via QR token
 */

import { NextRequest } from 'next/server';
import { requireRole, unauthorizedResponse, badRequestResponse, notFoundResponse, serverErrorResponse } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import { validateQRToken } from '@/lib/qr/token';
import { cookies } from 'next/headers';

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
    return unauthorizedResponse('Only Helpers can join jobs');
  }

  try {
    const jobId = params.id;
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return badRequestResponse('Token is required');
    }

    // Validate and consume token
    const result = await validateQRToken(token, user.id);

    if (!result) {
      return badRequestResponse('Invalid, expired, or already used token');
    }

    if (result.jobId !== jobId) {
      return badRequestResponse('Token does not match this job');
    }

    // Get the job
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return notFoundResponse('Job not found');
    }

    // Check if job is in correct status
    if (job.status !== 'OPEN') {
      return badRequestResponse('Job is not available');
    }

    // Create assignment and update job status in transaction
    // The unique constraint on jobId will prevent double-booking
    try {
      await prisma.$transaction([
        prisma.assignment.create({
          data: {
            jobId,
            helperId: user.id,
          },
        }),
        prisma.job.update({
          where: { id: jobId },
          data: { status: 'ACCEPTED' },
        }),
      ]);
    } catch (error: any) {
      // Handle unique constraint violation (job already has a Helper)
      if (error.code === 'P2002') {
        return badRequestResponse('Job already has a Helper');
      }
      throw error;
    }

    return Response.json({
      success: true,
      message: 'Successfully joined job',
      jobId,
    });
  } catch (error) {
    console.error('Join job failed:', error);
    return serverErrorResponse();
  }
}
