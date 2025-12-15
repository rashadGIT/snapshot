/**
 * QR Code Generation API
 * POST /api/jobs/[id]/qr - Generate QR token for job
 */

import { NextRequest } from 'next/server';
import { requireRole, unauthorizedResponse, notFoundResponse, serverErrorResponse } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import { createQRToken } from '@/lib/qr/token';
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
  const user = await requireRole(authRequest, ['REQUESTER']);

  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const jobId = params.id;

    // Verify job exists and belongs to requester
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return notFoundResponse('Job not found');
    }

    if (job.requesterId !== user.id) {
      return unauthorizedResponse('Not your job');
    }

    // Don't generate QR for completed/cancelled jobs
    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      return Response.json(
        { error: `Cannot generate QR for ${job.status} jobs` },
        { status: 400 }
      );
    }

    // Generate QR token
    const qrData = await createQRToken(jobId);

    return Response.json({
      token: qrData.token,
      shortCode: qrData.shortCode,
      expiresAt: qrData.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('QR generation failed:', error);
    return serverErrorResponse();
  }
}
