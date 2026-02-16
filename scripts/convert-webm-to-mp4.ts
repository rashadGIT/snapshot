/**
 * WebM to MP4 Conversion Script
 *
 * Batch converts all unconverted WebM videos to MP4 format for Safari/iOS compatibility.
 *
 * Usage:
 *   npx tsx scripts/convert-webm-to-mp4.ts [--dry-run]
 *
 * Features:
 * - Checkpoint/resume system (handles interruptions)
 * - Progress tracking
 * - Error isolation (one failure doesn't stop batch)
 * - Dry-run mode for testing
 */

import { prisma } from '../src/lib/db/prisma';
import { convertUpload } from '../src/lib/video/conversion';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Checkpoint data structure
 */
interface ConversionCheckpoint {
  totalVideos: number;
  processedVideos: number;
  successfulConversions: number;
  failedConversions: number;
  failedIds: string[];
  lastProcessedId: string;
  startedAt: string;
  lastUpdatedAt: string;
}

const CHECKPOINT_FILE = './conversion-checkpoint.json';
const isDryRun = process.argv.includes('--dry-run');

/**
 * Save checkpoint to disk
 */
function saveCheckpoint(checkpoint: ConversionCheckpoint): void {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2), 'utf-8');
  console.log(`[Checkpoint] Saved: ${checkpoint.processedVideos}/${checkpoint.totalVideos} processed`);
}

/**
 * Load checkpoint from disk if exists
 */
function loadCheckpoint(): ConversionCheckpoint | null {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    const data = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
    const checkpoint = JSON.parse(data) as ConversionCheckpoint;
    console.log('[Checkpoint] Loaded existing checkpoint:');
    console.log(`  - Total: ${checkpoint.totalVideos}`);
    console.log(`  - Processed: ${checkpoint.processedVideos}`);
    console.log(`  - Successful: ${checkpoint.successfulConversions}`);
    console.log(`  - Failed: ${checkpoint.failedConversions}`);
    console.log(`  - Last ID: ${checkpoint.lastProcessedId}`);
    return checkpoint;
  }
  return null;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Main conversion function
 */
async function convertAllWebmVideos(): Promise<void> {
  console.log('\n🎬 WebM to MP4 Conversion Script\n');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no actual conversion)' : 'LIVE'}`);
  console.log('─'.repeat(60));

  // Load or initialize checkpoint
  let checkpoint = loadCheckpoint() || {
    totalVideos: 0,
    processedVideos: 0,
    successfulConversions: 0,
    failedConversions: 0,
    failedIds: [],
    lastProcessedId: '',
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  };

  const startTime = Date.now();

  try {
    // Query unconverted WebM videos
    console.log('\n📊 Querying unconverted WebM videos...');

    const whereClause: any = {
      fileType: 'video/webm',
      convertedS3Key: null, // Only unconverted
    };

    // Resume from last processed ID if checkpoint exists
    if (checkpoint.lastProcessedId) {
      whereClause.id = { gt: checkpoint.lastProcessedId };
      console.log(`   Resuming from ID: ${checkpoint.lastProcessedId}`);
    }

    const uploads = await prisma.upload.findMany({
      where: whereClause,
      orderBy: { id: 'asc' }, // Consistent ordering for resume
      include: {
        job: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    checkpoint.totalVideos = uploads.length + checkpoint.processedVideos;

    console.log(`\n   Found: ${uploads.length} videos to convert`);
    console.log(`   Already processed: ${checkpoint.processedVideos}`);
    console.log(`   Total to process: ${checkpoint.totalVideos}`);

    if (uploads.length === 0) {
      console.log('\n✅ No unconverted videos found. All done!');
      return;
    }

    if (isDryRun) {
      console.log('\n📋 Dry run - would convert:');
      uploads.slice(0, 10).forEach((upload, index) => {
        console.log(`   ${index + 1}. ${upload.fileName} (${formatBytes(upload.fileSize)})`);
      });
      if (uploads.length > 10) {
        console.log(`   ... and ${uploads.length - 10} more`);
      }
      console.log('\n💡 Run without --dry-run to perform actual conversion');
      return;
    }

    console.log('\n🔄 Starting conversion...\n');

    // Process each upload
    for (const upload of uploads) {
      const progress = checkpoint.processedVideos + 1;
      const progressBar = `[${progress}/${checkpoint.totalVideos}]`;

      console.log(`${progressBar} Converting: ${upload.fileName}`);
      console.log(`   Job: ${upload.job.title}`);
      console.log(`   Size: ${formatBytes(upload.fileSize)}`);
      console.log(`   S3 Key: ${upload.s3Key}`);

      try {
        // Convert the upload
        const result = await convertUpload({
          uploadId: upload.id,
          s3Bucket: upload.s3Bucket,
          s3Key: upload.s3Key,
          fileName: upload.fileName,
          onProgress: (progress) => {
            // Log progress every 25%
            if (progress.percent && progress.percent % 25 < 1) {
              console.log(`   Progress: ${progress.percent.toFixed(0)}% - ${progress.currentTime}`);
            }
          },
        });

        // Update database
        await prisma.upload.update({
          where: { id: upload.id },
          data: {
            convertedS3Key: result.convertedS3Key,
            convertedFileType: 'video/mp4',
            convertedFileSize: result.convertedFileSize,
            convertedAt: new Date(),
          },
        });

        checkpoint.successfulConversions++;
        console.log(`   ✅ Success! Converted to: ${result.convertedS3Key}`);
        console.log(`   Size: ${formatBytes(result.convertedFileSize)}\n`);
      } catch (error) {
        checkpoint.failedConversions++;
        checkpoint.failedIds.push(upload.id);
        console.error(`   ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
      } finally {
        checkpoint.processedVideos++;
        checkpoint.lastProcessedId = upload.id;
        checkpoint.lastUpdatedAt = new Date().toISOString();
        saveCheckpoint(checkpoint);
      }
    }

    // Final summary
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 Conversion Complete!');
    console.log('═'.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`   Total videos: ${checkpoint.totalVideos}`);
    console.log(`   Successful: ${checkpoint.successfulConversions} ✅`);
    console.log(`   Failed: ${checkpoint.failedConversions} ❌`);
    console.log(`   Duration: ${formatDuration(duration)}`);

    if (checkpoint.failedConversions > 0) {
      console.log(`\n❌ Failed conversion IDs:`);
      checkpoint.failedIds.forEach((id, index) => {
        console.log(`   ${index + 1}. ${id}`);
      });
      console.log(`\n💡 You can retry failed conversions by querying these IDs`);
    }

    // Clean up checkpoint file on success
    if (checkpoint.failedConversions === 0) {
      fs.unlinkSync(CHECKPOINT_FILE);
      console.log('\n✨ Checkpoint file removed (no failures)');
    } else {
      console.log(`\n📝 Checkpoint saved to: ${CHECKPOINT_FILE}`);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.log(`\n📝 Progress saved. Run again to resume.`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the conversion
convertAllWebmVideos()
  .then(() => {
    console.log('\n👋 Done!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Unhandled error:', error);
    process.exit(1);
  });
