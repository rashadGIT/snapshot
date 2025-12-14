/**
 * QR Token Generation and Validation
 * Short-lived tokens for secure job joining
 */

import { createHash, randomBytes } from 'crypto';
import { customAlphabet } from 'nanoid';
import { prisma } from '@/lib/db/prisma';

const QR_TOKEN_SECRET = process.env.QR_TOKEN_SECRET!;
const TOKEN_EXPIRY_MINUTES = 15;

// Generate 6-digit numeric short code
const generateShortCode = customAlphabet('0123456789', 6);

/**
 * Generate a secure token for QR code
 * Uses HMAC-based token tied to job ID
 */
function generateSecureToken(jobId: string): string {
  const randomPart = randomBytes(16).toString('hex');
  const hmac = createHash('sha256')
    .update(`${jobId}:${randomPart}:${QR_TOKEN_SECRET}`)
    .digest('hex');

  return `${randomPart}.${hmac}`;
}

/**
 * Create a new QR token for a job
 * Returns token and short code for display
 */
export async function createQRToken(jobId: string): Promise<{
  token: string;
  shortCode: string;
  expiresAt: Date;
}> {
  const token = generateSecureToken(jobId);
  const shortCode = generateShortCode();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

  await prisma.qRToken.create({
    data: {
      jobId,
      token,
      shortCode,
      expiresAt,
    },
  });

  return { token, shortCode, expiresAt };
}

/**
 * Validate and consume a QR token
 * Returns job ID if valid, null if invalid/expired/used
 */
export async function validateQRToken(
  tokenOrCode: string,
  helperId: string,
): Promise<{ jobId: string } | null> {
  // Try to find token by token string or short code
  const qrToken = await prisma.qRToken.findFirst({
    where: {
      OR: [{ token: tokenOrCode }, { shortCode: tokenOrCode }],
    },
    include: {
      job: {
        include: {
          assignments: true,
        },
      },
    },
  });

  if (!qrToken) {
    return null;
  }

  // Check if token is expired
  if (qrToken.expiresAt < new Date()) {
    return null;
  }

  // Check if token is already used
  if (qrToken.isUsed) {
    return null;
  }

  // Check if job already has a Helper assigned (Phase 1: one Helper per job)
  if (qrToken.job.assignments.length > 0) {
    return null;
  }

  // Check if job is in correct status (must be OPEN)
  if (qrToken.job.status !== 'OPEN') {
    return null;
  }

  // Mark token as used
  await prisma.qRToken.update({
    where: { id: qrToken.id },
    data: {
      isUsed: true,
      scannedAt: new Date(),
      scannedBy: helperId,
    },
  });

  return { jobId: qrToken.jobId };
}

/**
 * Check if a token is valid without consuming it
 * Used for preview/validation before accepting
 */
export async function checkQRToken(tokenOrCode: string): Promise<{
  valid: boolean;
  jobId?: string;
  reason?: string;
}> {
  const qrToken = await prisma.qRToken.findFirst({
    where: {
      OR: [{ token: tokenOrCode }, { shortCode: tokenOrCode }],
    },
    include: {
      job: {
        include: {
          assignments: true,
        },
      },
    },
  });

  if (!qrToken) {
    return { valid: false, reason: 'Invalid token' };
  }

  if (qrToken.expiresAt < new Date()) {
    return { valid: false, reason: 'Token expired' };
  }

  if (qrToken.isUsed) {
    return { valid: false, reason: 'Token already used' };
  }

  if (qrToken.job.assignments.length > 0) {
    return { valid: false, reason: 'Job already has a Helper' };
  }

  if (qrToken.job.status !== 'OPEN') {
    return { valid: false, reason: 'Job is not available' };
  }

  return { valid: true, jobId: qrToken.jobId };
}
