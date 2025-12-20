/**
 * Download URL API
 * GET /api/uploads/download?s3Key=... - Get pre-signed download URL with access control
 */

import { NextRequest } from 'next/server';
import { authenticateRequest, unauthorizedResponse, badRequestResponse, serverErrorResponse } from '@/lib/auth/middleware';
import { prisma } from '@/lib/db/prisma';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { cookies } from 'next/headers';
import { logger } from '@/lib/utils/logger';

// S3 Configuration
function getS3Config() {
  const AWS_REGION = process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1';
  const AWS_ENDPOINT_URL = process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT_URL;
  const AWS_S3_BUCKET = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
  const AWS_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const AWS_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

  if (!AWS_S3_BUCKET || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    throw new Error('S3 configuration is incomplete');
  }

  return {
    region: AWS_REGION,
    bucket: AWS_S3_BUCKET,
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    endpoint: AWS_ENDPOINT_URL,
  };
}

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

  const userId = auth.user.cognitoSub;

  try {
    const { searchParams } = new URL(request.url);
    const s3Key = searchParams.get('s3Key');

    if (!s3Key) {
      return badRequestResponse('s3Key parameter is required');
    }

    // Find the upload record to get the job ID
    const upload = await prisma.upload.findFirst({
      where: { s3Key },
      include: {
        job: {
          include: {
            requester: true,
            assignments: {
              include: {
                helper: true,
              },
            },
          },
        },
      },
    });

    if (!upload) {
      return unauthorizedResponse('Upload not found');
    }

    const job = upload.job;
    const isRequester = userId === job.requesterId;
    const helperAssignment = job.assignments.find((a) => a.helperId === userId);
    const isHelper = !!helperAssignment;

    // Access control rules
    if (!isRequester && !isHelper) {
      return unauthorizedResponse('You do not have access to this upload');
    }

    // Helper can only access when job is IN_PROGRESS or IN_REVIEW
    if (isHelper && !['IN_PROGRESS', 'IN_REVIEW'].includes(job.status)) {
      return unauthorizedResponse(`Helpers can only access uploads when job is IN_PROGRESS or IN_REVIEW (current: ${job.status})`);
    }

    // Requester can always access their job uploads
    // Generate pre-signed download URL (valid for 5 minutes)
    const config = getS3Config();
    const s3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      ...(config.endpoint && {
        endpoint: config.endpoint,
        forcePathStyle: true,
      }),
    });

    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: s3Key,
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn: 300, // 5 minutes
    });

    return Response.json({ url });
  } catch (error: unknown) {
    logger.error('Download URL generation failed:', error);
    return serverErrorResponse();
  }
}
