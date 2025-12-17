/**
 * Login endpoint
 * Initiates Cognito Hosted UI OAuth flow with PKCE
 */

import { NextRequest, NextResponse } from 'next/server';
import { generatePKCE, getCognitoLoginUrl } from '@/lib/auth/cognito';
import { cookies } from 'next/headers';

export async function GET(_request: NextRequest) {
  // Generate PKCE challenge
  const { codeVerifier, codeChallenge } = generatePKCE();

  // Store code verifier in HTTP-only cookie for callback
  const cookieStore = await cookies();
  cookieStore.set('pkce_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  // Redirect to Cognito Hosted UI
  const loginUrl = getCognitoLoginUrl(codeChallenge);
  return NextResponse.redirect(loginUrl);
}
