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
    console.log('[Upload API] Received request:', { jobId, body });

    const validated = recordUploadSchema.parse(body);
    console.log('[Upload API] Validated data:', validated);

    // Verify Helper is assigned to job
    const assignment = await prisma.assignment.findFirst({
      where: {
        jobId,
        helperId: user.id,
      },
    });

    if (!assignment) {
      console.error('[Upload API] User not assigned to job:', { userId: user.id, jobId });
      return unauthorizedResponse('Not assigned to this job');
    }

    console.log('[Upload API] Assignment found:', assignment.id);

    // Record upload
    console.log('[Upload API] Creating upload record...');
    const upload = await prisma.upload.create({
      data: {
        jobId,
        uploadedBy: user.id,
        s3Key: validated.s3Key,
        s3Bucket: validated.s3Bucket,
        fileName: validated.fileName,
        fileType: validated.fileType,
        fileSize: validated.fileSize,
        thumbnailKey: validated.thumbnailKey,
      },
    });

    console.log('[Upload API] Upload created:', upload.id);

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

    console.log('[Upload API] Success!');
    return Response.json({ upload });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      console.error('[Upload API] Validation error:', error.errors);
      return badRequestResponse(error.errors[0].message);
    }
    console.error('[Upload API] Upload recording failed:', error);
    console.error('[Upload API] Error stack:', error.stack);
    return serverErrorResponse();
  }
}
