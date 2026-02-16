/**
 * Debug API - Check Upload Status
 * GET /api/debug/check-upload?filename=video-xxx.webm
 *
 * IMPORTANT: Remove this file before deploying to production!
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { authenticateRequest, unauthorizedResponse, badRequestResponse, serverErrorResponse } from '@/lib/auth/middleware';
import { cookies } from 'next/headers';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

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

  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');
    const s3Key = searchParams.get('s3Key');

    if (!filename && !s3Key) {
      return badRequestResponse('Either filename or s3Key parameter is required');
    }

    let uploads;

    if (s3Key) {
      // Search by S3 key
      uploads = await prisma.upload.findMany({
        where: {
          OR: [
            { s3Key },
            { thumbnailKey: s3Key },
          ],
        },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
          uploader: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          uploadedAt: 'desc',
        },
      });
    } else if (filename) {
      // Search by filename
      uploads = await prisma.upload.findMany({
        where: {
          fileName: {
            contains: filename,
          },
        },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
          uploader: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          uploadedAt: 'desc',
        },
      });
    } else {
      // Should never reach here due to earlier validation
      return badRequestResponse('Invalid parameters');
    }

    if (uploads.length === 0) {
      // Search for recent video uploads
      const recentVideos = await prisma.upload.findMany({
        where: {
          fileType: {
            startsWith: 'video/',
          },
        },
        orderBy: {
          uploadedAt: 'desc',
        },
        take: 10,
        select: {
          id: true,
          fileName: true,
          fileType: true,
          s3Key: true,
          uploadedAt: true,
          job: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      return Response.json({
        found: false,
        message: `No uploads found with ${filename ? 'filename' : 's3Key'}: ${filename || s3Key}`,
        recentVideos,
      });
    }

    // Check if file exists in S3
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

    const uploadResults = await Promise.all(
      uploads.map(async (upload) => {
        try {
          const headCommand = new HeadObjectCommand({
            Bucket: config.bucket,
            Key: upload.s3Key,
          });

          const headResult = await s3Client.send(headCommand);

          return {
            upload: {
              id: upload.id,
              fileName: upload.fileName,
              fileType: upload.fileType,
              fileSize: upload.fileSize,
              s3Key: upload.s3Key,
              s3Bucket: upload.s3Bucket,
              uploadedAt: upload.uploadedAt,
              uploader: upload.uploader.name || upload.uploader.email,
              job: {
                id: upload.job.id,
                title: upload.job.title,
                status: upload.job.status,
              },
            },
            s3Status: {
              exists: true,
              contentType: headResult.ContentType,
              contentLength: headResult.ContentLength,
              lastModified: headResult.LastModified,
              metadata: headResult.Metadata,
            },
          };
        } catch (s3Error: any) {
          return {
            upload: {
              id: upload.id,
              fileName: upload.fileName,
              fileType: upload.fileType,
              fileSize: upload.fileSize,
              s3Key: upload.s3Key,
              s3Bucket: upload.s3Bucket,
              uploadedAt: upload.uploadedAt,
              uploader: upload.uploader.name || upload.uploader.email,
              job: {
                id: upload.job.id,
                title: upload.job.title,
                status: upload.job.status,
              },
            },
            s3Status: {
              exists: false,
              error: s3Error.message || 'Unknown error',
              errorCode: s3Error.$metadata?.httpStatusCode || s3Error.statusCode,
            },
          };
        }
      })
    );

    return Response.json({
      found: true,
      count: uploads.length,
      results: uploadResults,
    });
  } catch (error: unknown) {
    console.error('Check upload failed:', error);
    return serverErrorResponse();
  }
}
