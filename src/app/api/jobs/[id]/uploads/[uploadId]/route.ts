/**
 * Delete Upload API
 * DELETE /api/jobs/[id]/uploads/[uploadId]
 * - Helper can delete before submission
 * - Requester can delete during review (IN_REVIEW status)
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; uploadId: string } }
) {
  const authRequest = await getAuthRequest(request);
  const user = await requireRole(authRequest, ['HELPER', 'REQUESTER']);

  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const jobId = params.id;
    const uploadId = params.uploadId;

    // Find upload
    const upload = await prisma.upload.findUnique({
      where: { id: uploadId },
      include: {
        job: {
          include: {
            assignments: true,
          },
        },
      },
    });

    if (!upload) {
      return notFoundResponse('Upload not found');
    }

    // Verify upload belongs to this job
    if (upload.jobId !== jobId) {
      return unauthorizedResponse('Upload does not belong to this job');
    }

    // Check permissions based on role
    if (user.activeRole === 'HELPER') {
      // Helper can only delete their own uploads before job is completed
      if (upload.uploadedBy !== user.id) {
        return unauthorizedResponse('You can only delete your own uploads');
      }

      const isAssigned = upload.job.assignments.some((a) => a.helperId === user.id);
      if (!isAssigned) {
        return unauthorizedResponse('Not assigned to this job');
      }

      // Helper cannot delete after job is approved
      if (upload.job.status === 'COMPLETED') {
        return badRequestResponse('Cannot delete uploads from completed jobs');
      }
    } else if (user.activeRole === 'REQUESTER') {
      // Requester can only delete during review period (IN_REVIEW status)
      if (upload.job.requesterId !== user.id) {
        return unauthorizedResponse('Not your job');
      }

      if (upload.job.status !== 'IN_REVIEW') {
        return badRequestResponse('Can only delete uploads during review period');
      }
    }

    // Delete from database (S3 file will remain but we could add deletion later)
    await prisma.upload.delete({
      where: { id: uploadId },
    });

    return Response.json({
      message: 'Upload deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete upload:', error);
    return serverErrorResponse();
  }
}
