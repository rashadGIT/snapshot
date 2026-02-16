/**
 * Check video upload in database
 * Usage: npx tsx check-video-upload.ts <filename>
 */

import { prisma } from './src/lib/db/prisma';

const filename = process.argv[2];

if (!filename) {
  console.error('Usage: npx tsx check-video-upload.ts <filename>');
  console.error('Example: npx tsx check-video-upload.ts video-1767544677095.webm');
  process.exit(1);
}

async function checkUpload() {
  console.log(`Searching for upload with filename: ${filename}\n`);

  // Search by filename
  const uploads = await prisma.upload.findMany({
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

  if (uploads.length === 0) {
    console.log('❌ No uploads found with that filename');
    console.log('\nSearching for recent video uploads...\n');

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

    console.log('Recent video uploads:');
    console.table(recentVideos.map(u => ({
      fileName: u.fileName,
      fileType: u.fileType,
      s3Key: u.s3Key,
      uploadedAt: u.uploadedAt,
      jobTitle: u.job.title,
    })));
  } else {
    console.log(`✅ Found ${uploads.length} upload(s):\n`);

    uploads.forEach((upload, index) => {
      console.log(`Upload #${index + 1}:`);
      console.log(`  ID: ${upload.id}`);
      console.log(`  Filename: ${upload.fileName}`);
      console.log(`  File Type: ${upload.fileType}`);
      console.log(`  File Size: ${upload.fileSize} bytes (${(upload.fileSize / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`  S3 Key: ${upload.s3Key}`);
      console.log(`  S3 Bucket: ${upload.s3Bucket}`);
      console.log(`  Uploaded At: ${upload.uploadedAt}`);
      console.log(`  Uploaded By: ${upload.uploader.name || upload.uploader.email}`);
      console.log(`  Job: ${upload.job.title} (${upload.job.id})`);
      console.log(`  Job Status: ${upload.job.status}`);
      if (upload.thumbnailKey) {
        console.log(`  Thumbnail: ${upload.thumbnailKey}`);
      }
      console.log('');
    });

    console.log('\nTo check if file exists in S3, run:');
    console.log(`  ./check-s3-video.sh "${uploads[0].s3Key}"`);
  }

  await prisma.$disconnect();
}

checkUpload().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
