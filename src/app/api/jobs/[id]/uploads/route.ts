/**
 * Job Uploads API
 * POST /api/jobs/[id]/uploads - Record completed upload
 * GET /api/jobs/[id]/uploads - List uploads for job
 */

import { NextRequest } from 'next/server';
import { requireRole, unauthorizedResponse, badRequestResponse, serverErrorResponse } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import { recordUploadSchema } from '@/lib/validation/schemas';
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
    return unauthorizedResponse();
  }

  try {
    const jobId = params.id;
    const body = await request.json();
    const validated = recordUploadSchema.parse(body);

    // Verify Helper is assigned to job
    const assignment = await prisma.assignment.findFirst({
      where: {
        jobId,
        helperId: user.id,
      },
    });

    if (!assignment) {
      return unauthorizedResponse('Not assigned to this job');
    }

    // Record upload
    const upload = await prisma.upload.create({
      data: {
        jobId,
        uploadedBy: user.id,
        s3Key: validated.s3Key,
        s3Bucket: validated.s3Bucket,
        fileName: validated.fileName,
        fileType: validated.fileType,
        fileSize: validated.fileSize,
      },
    });

    // Update job status to IN_PROGRESS if still ACCEPTED
    await prisma.job.updateMany({
      where: {
        id: jobId,
        status: 'ACCEPTED',
      },
      data: {
        status: 'IN_PROGRESS',
      },
    });

    return Response.json({ upload });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return badRequestResponse(error.errors[0].message);
    }
    console.error('Upload recording failed:', error);
    return serverErrorResponse();
  }
}
