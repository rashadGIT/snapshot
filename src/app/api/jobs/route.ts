/**
 * Jobs API
 * GET: List jobs (filtered by role)
 * POST: Create new job (Requester only)
 */

import { NextRequest } from 'next/server';
import { requireRole, unauthorizedResponse, badRequestResponse, serverErrorResponse } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import { createJobSchema } from '@/lib/validation/schemas';
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

/**
 * GET /api/jobs
 * List jobs filtered by user role
 */
export async function GET(request: NextRequest) {
  const authRequest = await getAuthRequest(request);
  const user = await requireRole(authRequest, ['REQUESTER', 'HELPER']);

  if (!user) {
    return unauthorizedResponse();
  }

  try {
    let jobs;

    if (user.role === 'REQUESTER') {
      // Requesters see their own jobs
      jobs = await prisma.job.findMany({
        where: { requesterId: user.id },
        include: {
          assignments: {
            include: { helper: true },
          },
          uploads: true,
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Helpers see jobs they're assigned to
      jobs = await prisma.job.findMany({
        where: {
          assignments: {
            some: { helperId: user.id },
          },
        },
        include: {
          requester: true,
          assignments: true,
          uploads: true,
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return Response.json({ jobs });
  } catch (error) {
    console.error('Failed to fetch jobs:', error);
    return serverErrorResponse();
  }
}

/**
 * POST /api/jobs
 * Create new job (Requester only)
 */
export async function POST(request: NextRequest) {
  const authRequest = await getAuthRequest(request);
  const user = await requireRole(authRequest, ['REQUESTER']);

  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const validated = createJobSchema.parse(body);

    const job = await prisma.job.create({
      data: {
        ...validated,
        eventTime: new Date(validated.eventTime),
        requesterId: user.id,
      },
    });

    return Response.json({ job }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return badRequestResponse(error.errors[0].message);
    }
    console.error('Failed to create job:', error);
    return serverErrorResponse();
  }
}
