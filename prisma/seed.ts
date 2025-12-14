/**
 * Database Seed Script
 * Populates database with mock users, jobs, and related data
 */

import { PrismaClient, UserRole, JobStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.rating.deleteMany();
  await prisma.upload.deleteMany();
  await prisma.message.deleteMany();
  await prisma.qRToken.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.job.deleteMany();
  await prisma.user.deleteMany();

  // Create mock users
  const users = await Promise.all([
    // Requesters
    prisma.user.create({
      data: {
        cognitoSub: 'mock-cognito-sub-req-1',
        email: 'sophia.requester@example.com',
        name: 'Sophia Martinez',
        role: UserRole.REQUESTER,
        authProvider: 'google',
        verificationStatus: 'verified',
      },
    }),
    prisma.user.create({
      data: {
        cognitoSub: 'mock-cognito-sub-req-2',
        email: 'emma.influencer@example.com',
        name: 'Emma Williams',
        role: UserRole.REQUESTER,
        authProvider: 'google',
        verificationStatus: 'verified',
      },
    }),
    prisma.user.create({
      data: {
        cognitoSub: 'mock-cognito-sub-req-3',
        email: 'olivia.brand@example.com',
        name: 'Olivia Johnson',
        role: UserRole.REQUESTER,
        authProvider: 'google',
        verificationStatus: 'verified',
      },
    }),
    prisma.user.create({
      data: {
        cognitoSub: 'mock-cognito-sub-req-4',
        email: 'ava.content@example.com',
        name: 'Ava Davis',
        role: UserRole.REQUESTER,
        authProvider: 'google',
        verificationStatus: 'verified',
      },
    }),

    // Helpers
    prisma.user.create({
      data: {
        cognitoSub: 'mock-cognito-sub-help-1',
        email: 'liam.helper@example.com',
        name: 'Liam Brown',
        role: UserRole.HELPER,
        authProvider: 'google',
        verificationStatus: 'verified',
      },
    }),
    prisma.user.create({
      data: {
        cognitoSub: 'mock-cognito-sub-help-2',
        email: 'noah.creator@example.com',
        name: 'Noah Miller',
        role: UserRole.HELPER,
        authProvider: 'google',
        verificationStatus: 'verified',
      },
    }),
    prisma.user.create({
      data: {
        cognitoSub: 'mock-cognito-sub-help-3',
        email: 'james.photo@example.com',
        name: 'James Wilson',
        role: UserRole.HELPER,
        authProvider: 'google',
        verificationStatus: 'verified',
      },
    }),
    prisma.user.create({
      data: {
        cognitoSub: 'mock-cognito-sub-help-4',
        email: 'lucas.video@example.com',
        name: 'Lucas Anderson',
        role: UserRole.HELPER,
        authProvider: 'google',
        verificationStatus: 'verified',
      },
    }),
  ]);

  const [req1, req2, req3, req4, help1, help2, help3, help4] = users;

  console.log(`✅ Created ${users.length} users`);

  // Create mock jobs in various statuses
  const jobs = [];

  // 1. OPEN job with active QR token
  const openJob = await prisma.job.create({
    data: {
      requesterId: req1.id,
      status: JobStatus.OPEN,
      title: 'Fashion Week After-Party Coverage',
      description: 'Need candid shots and short videos at an exclusive fashion event. Looking for creative angles and genuine moments.',
      location: 'The Standard Hotel, NYC',
      eventTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      contentType: 'both',
      notes: 'Please capture both posed and candid moments. Focus on outfits and atmosphere.',
      priceTier: 'premium',
    },
  });
  jobs.push(openJob);

  // Generate QR token for open job
  await prisma.qRToken.create({
    data: {
      jobId: openJob.id,
      token: 'mock-token-open-job-12345',
      shortCode: '123456',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    },
  });

  // 2. ACCEPTED job
  const acceptedJob = await prisma.job.create({
    data: {
      requesterId: req2.id,
      status: JobStatus.ACCEPTED,
      title: 'Product Launch Event Photos',
      description: 'Capture the atmosphere and guest reactions at our new product unveiling.',
      location: 'SoHo Pop-up Space, NYC',
      eventTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
      contentType: 'photos',
      priceTier: 'standard',
    },
  });
  jobs.push(acceptedJob);

  await prisma.assignment.create({
    data: {
      jobId: acceptedJob.id,
      helperId: help1.id,
    },
  });

  // 3. IN_PROGRESS job
  const inProgressJob = await prisma.job.create({
    data: {
      requesterId: req3.id,
      status: JobStatus.IN_PROGRESS,
      title: 'Sunset Beach Lifestyle Content',
      description: 'Need golden hour beach shots for social media. Natural lighting, casual vibes.',
      location: 'Venice Beach, CA',
      eventTime: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
      contentType: 'both',
      notes: 'Looking for warm, authentic moments. Bring portable lighting if possible.',
      priceTier: 'premium',
    },
  });
  jobs.push(inProgressJob);

  await prisma.assignment.create({
    data: {
      jobId: inProgressJob.id,
      helperId: help2.id,
    },
  });

  await prisma.message.create({
    data: {
      jobId: inProgressJob.id,
      userId: req3.id,
      content: 'Just arrived! Meet me at the volleyball courts.',
    },
  });

  await prisma.message.create({
    data: {
      jobId: inProgressJob.id,
      userId: help2.id,
      content: 'On my way, ETA 5 minutes!',
    },
  });

  // 4. UPLOADED job
  const uploadedJob = await prisma.job.create({
    data: {
      requesterId: req4.id,
      status: JobStatus.UPLOADED,
      title: 'Restaurant Grand Opening',
      description: 'Cover the ribbon cutting and first guests. Need interior shots of the space.',
      location: 'Brooklyn Heights, NYC',
      eventTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      contentType: 'both',
      priceTier: 'standard',
    },
  });
  jobs.push(uploadedJob);

  await prisma.assignment.create({
    data: {
      jobId: uploadedJob.id,
      helperId: help3.id,
    },
  });

  // Mock uploads
  await prisma.upload.createMany({
    data: [
      {
        jobId: uploadedJob.id,
        uploadedBy: help3.id,
        s3Key: `${uploadedJob.id}/mock-photo-001.jpg`,
        s3Bucket: 'snapspot-uploads',
        fileName: 'ribbon-cutting.jpg',
        fileType: 'image/jpeg',
        fileSize: 2048576,
      },
      {
        jobId: uploadedJob.id,
        uploadedBy: help3.id,
        s3Key: `${uploadedJob.id}/mock-photo-002.jpg`,
        s3Bucket: 'snapspot-uploads',
        fileName: 'interior-shot.jpg',
        fileType: 'image/jpeg',
        fileSize: 3145728,
      },
      {
        jobId: uploadedJob.id,
        uploadedBy: help3.id,
        s3Key: `${uploadedJob.id}/mock-video-001.mp4`,
        s3Bucket: 'snapspot-uploads',
        fileName: 'grand-opening.mp4',
        fileType: 'video/mp4',
        fileSize: 15728640,
      },
    ],
  });

  // 5. COMPLETED job with ratings
  const completedJob = await prisma.job.create({
    data: {
      requesterId: req1.id,
      status: JobStatus.COMPLETED,
      title: 'Art Gallery Opening Night',
      description: 'Capture the vernissage and artist interactions. Focus on the artwork and attendees.',
      location: 'Chelsea Art District, NYC',
      eventTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      contentType: 'photos',
      priceTier: 'premium',
      completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    },
  });
  jobs.push(completedJob);

  await prisma.assignment.create({
    data: {
      jobId: completedJob.id,
      helperId: help4.id,
    },
  });

  await prisma.upload.createMany({
    data: [
      {
        jobId: completedJob.id,
        uploadedBy: help4.id,
        s3Key: `${completedJob.id}/mock-gallery-001.jpg`,
        s3Bucket: 'snapspot-uploads',
        fileName: 'artwork-display.jpg',
        fileType: 'image/jpeg',
        fileSize: 4194304,
      },
      {
        jobId: completedJob.id,
        uploadedBy: help4.id,
        s3Key: `${completedJob.id}/mock-gallery-002.jpg`,
        s3Bucket: 'snapspot-uploads',
        fileName: 'crowd-shot.jpg',
        fileType: 'image/jpeg',
        fileSize: 3670016,
      },
    ],
  });

  // Bi-directional ratings
  await prisma.rating.createMany({
    data: [
      {
        jobId: completedJob.id,
        fromUserId: req1.id,
        toUserId: help4.id,
        score: 5,
        comment: 'Excellent work! Photos captured the atmosphere perfectly. Very professional.',
      },
      {
        jobId: completedJob.id,
        fromUserId: help4.id,
        toUserId: req1.id,
        score: 5,
        comment: 'Great event and clear instructions. Would work together again!',
      },
    ],
  });

  // 6. CANCELLED job
  const cancelledJob = await prisma.job.create({
    data: {
      requesterId: req2.id,
      status: JobStatus.CANCELLED,
      title: 'Street Market Food Vendor Coverage',
      description: 'Need vibrant photos of food stalls and street atmosphere.',
      location: 'Smorgasburg, Brooklyn',
      eventTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      contentType: 'photos',
      priceTier: 'basic',
      cancelledAt: new Date(),
    },
  });
  jobs.push(cancelledJob);

  // Additional jobs for variety
  const moreJobs = await Promise.all([
    prisma.job.create({
      data: {
        requesterId: req3.id,
        status: JobStatus.OPEN,
        title: 'Yoga Class Lifestyle Content',
        description: 'Capture the energy and peaceful vibes of a rooftop yoga session.',
        location: 'Williamsburg Rooftop, Brooklyn',
        eventTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        contentType: 'both',
        priceTier: 'standard',
      },
    }),
    prisma.job.create({
      data: {
        requesterId: req4.id,
        status: JobStatus.OPEN,
        title: 'Tech Startup Demo Day',
        description: 'Document our pitch presentation and team interactions.',
        location: 'WeWork, San Francisco',
        eventTime: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        contentType: 'videos',
        notes: 'Please capture wide shots of the audience and close-ups during the pitch.',
        priceTier: 'premium',
      },
    }),
    prisma.job.create({
      data: {
        requesterId: req1.id,
        status: JobStatus.COMPLETED,
        title: 'Boutique Pop-up Shop',
        description: 'Need photos of the space setup and first customers.',
        location: 'Lower East Side, NYC',
        eventTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        contentType: 'photos',
        priceTier: 'basic',
        completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.job.create({
      data: {
        requesterId: req2.id,
        status: JobStatus.ACCEPTED,
        title: 'Music Festival Backstage Access',
        description: 'Capture behind-the-scenes moments with performers.',
        location: 'Brooklyn Steel',
        eventTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        contentType: 'both',
        notes: 'VIP access provided. Focus on candid moments.',
        priceTier: 'premium',
      },
    }),
    prisma.job.create({
      data: {
        requesterId: req3.id,
        status: JobStatus.IN_PROGRESS,
        title: 'Farmers Market Morning Rush',
        description: 'Early morning market vibes and vendor interactions.',
        location: 'Union Square Greenmarket, NYC',
        eventTime: new Date(Date.now() - 1 * 60 * 60 * 1000),
        contentType: 'photos',
        priceTier: 'basic',
      },
    }),
  ]);

  // Create assignments for some additional jobs
  await prisma.assignment.create({
    data: {
      jobId: moreJobs[3].id, // Music Festival
      helperId: help1.id,
    },
  });

  await prisma.assignment.create({
    data: {
      jobId: moreJobs[4].id, // Farmers Market
      helperId: help2.id,
    },
  });

  jobs.push(...moreJobs);

  console.log(`✅ Created ${jobs.length} jobs`);

  // Count totals
  const totalAssignments = await prisma.assignment.count();
  const totalMessages = await prisma.message.count();
  const totalUploads = await prisma.upload.count();
  const totalRatings = await prisma.rating.count();
  const totalTokens = await prisma.qRToken.count();

  console.log('\n📊 Seed Summary:');
  console.log(`   Users: ${users.length}`);
  console.log(`   Jobs: ${jobs.length}`);
  console.log(`   Assignments: ${totalAssignments}`);
  console.log(`   Messages: ${totalMessages}`);
  console.log(`   Uploads: ${totalUploads}`);
  console.log(`   Ratings: ${totalRatings}`);
  console.log(`   QR Tokens: ${totalTokens}`);
  console.log('\n🎉 Seeding complete!');
  console.log('\n🔑 Test QR Token: mock-token-open-job-12345 or short code: 123456');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
