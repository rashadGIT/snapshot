/**
 * Debug API - Check Conversion Status
 * GET /api/debug/conversion-status
 *
 * Returns count of unconverted WebM videos
 * IMPORTANT: Remove this file before final production deployment!
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { authenticateRequest, unauthorizedResponse, serverErrorResponse } from '@/lib/auth/middleware';
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

export async function GET(request: NextRequest) {
  const authRequest = await getAuthRequest(request);
  const auth = await authenticateRequest(authRequest);

  if (!auth) {
    return unauthorizedResponse('Authentication required');
  }

  try {
    // Count unconverted WebM videos
    const unconvertedCount = await prisma.upload.count({
      where: {
        fileType: 'video/webm',
        convertedS3Key: null,
      },
    });

    // Count converted videos
    const convertedCount = await prisma.upload.count({
      where: {
        fileType: 'video/webm',
        convertedS3Key: { not: null },
      },
    });

    // Count all videos
    const totalVideos = await prisma.upload.count({
      where: {
        fileType: { startsWith: 'video/' },
      },
    });

    // Get sample unconverted videos
    const sampleUnconverted = await prisma.upload.findMany({
      where: {
        fileType: 'video/webm',
        convertedS3Key: null,
      },
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        uploadedAt: true,
        job: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        uploadedAt: 'desc',
      },
      take: 5,
    });

    return Response.json({
      summary: {
        totalVideos,
        webmVideos: unconvertedCount + convertedCount,
        unconvertedWebm: unconvertedCount,
        convertedWebm: convertedCount,
        conversionProgress: convertedCount + unconvertedCount > 0
          ? `${((convertedCount / (convertedCount + unconvertedCount)) * 100).toFixed(1)}%`
          : 'N/A',
      },
      needsConversion: unconvertedCount > 0,
      sampleUnconverted,
    });
  } catch (error: unknown) {
    console.error('Conversion status check failed:', error);
    return serverErrorResponse();
  }
}
