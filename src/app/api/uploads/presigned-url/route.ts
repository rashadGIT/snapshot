/**
 * Pre-signed URL API
 * POST /api/uploads/presigned-url - Get pre-signed S3 URL for upload
 */

import { NextRequest } from 'next/server';
import { requireRole, unauthorizedResponse, badRequestResponse, serverErrorResponse } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import { generatePresignedUploadUrl } from '@/lib/storage/s3';
import { presignedUrlRequestSchema } from '@/lib/validation/schemas';
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

export async function POST(request: NextRequest) {
  const authRequest = await getAuthRequest(request);
  const user = await requireRole(authRequest, ['HELPER']);

  if (!user) {
    return unauthorizedResponse('Only Helpers can upload');
  }

  try {
    const body = await request.json();
    const validated = presignedUrlRequestSchema.parse(body);

    // Check if Helper is assigned to this job
    const assignment = await prisma.assignment.findFirst({
      where: {
        jobId: validated.jobId,
        helperId: user.id,
      },
      include: {
        job: true,
      },
    });

    if (!assignment) {
      return unauthorizedResponse('Not assigned to this job');
    }

    // Check if job status allows uploads (ACCEPTED or IN_PROGRESS)
    if (!['ACCEPTED', 'IN_PROGRESS'].includes(assignment.job.status)) {
      return badRequestResponse('Job is not in a state that allows uploads');
    }

    // Generate pre-signed URL
    const { url, key, bucket } = await generatePresignedUploadUrl(
      validated.jobId,
      validated.filename,
      validated.contentType,
      validated.fileSize,
    );

    return Response.json({ url, key, bucket });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return badRequestResponse(error.errors[0].message);
    }
    console.error('Pre-signed URL generation failed:', error);
    return serverErrorResponse();
  }
}
