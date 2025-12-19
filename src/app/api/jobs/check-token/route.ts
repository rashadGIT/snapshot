/**
 * Check QR Token API
 * POST /api/jobs/check-token - Validate token without consuming it
 */

import { NextRequest } from 'next/server';
import { checkQRToken } from '@/lib/qr/token';
import { badRequestResponse } from '@/lib/auth/middleware';
import { logger } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return badRequestResponse('Token is required');
    }

    const result = await checkQRToken(token);

    return Response.json(result);
  } catch (error) {
    logger.error('Token check failed:', error);
    return Response.json({ valid: false, reason: 'Invalid token' });
  }
}
