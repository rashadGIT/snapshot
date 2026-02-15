/**
 * Login endpoint
 * Initiates Cognito Hosted UI OAuth flow with PKCE
 */

import { NextRequest, NextResponse } from 'next/server';
import { generatePKCE, getCognitoLoginUrl } from '@/lib/auth/cognito';
import { cookies } from 'next/headers';
import { logger } from '@/lib/utils/logger';

// Force dynamic rendering (don't prerender at build time)
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    // Debug: Check if env vars are available directly
    logger.debug('Direct env check:', {
      COGNITO_CLIENT_ID: !!process.env.COGNITO_CLIENT_ID,
      COGNITO_REDIRECT_URI: !!process.env.COGNITO_REDIRECT_URI,
      NEXT_PUBLIC_COGNITO_DOMAIN: !!process.env.NEXT_PUBLIC_COGNITO_DOMAIN,
    });

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
  } catch (error) {
    logger.error('Login error:', error);

    // Try to get values directly
    const cognitoClientId = process.env.COGNITO_CLIENT_ID || process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
    const cognitoRedirectUri = process.env.COGNITO_REDIRECT_URI || process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    return NextResponse.json(
      {
        error: 'Login failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        env_check: {
          COGNITO_CLIENT_ID_value: cognitoClientId?.substring(0, 10) + '...',
          COGNITO_REDIRECT_URI_value: cognitoRedirectUri?.substring(0, 30) + '...',
          NEXT_PUBLIC_APP_URL_value: appUrl,
          hasCognitoClientId: !!cognitoClientId,
          hasCognitoDomain: !!process.env.NEXT_PUBLIC_COGNITO_DOMAIN,
          hasRedirectUri: !!cognitoRedirectUri,
          totalEnvKeys: Object.keys(process.env).length,
          allEnvKeys: Object.keys(process.env).filter(k => k.includes('COGNITO') || k.includes('APP_URL')),
        }
      },
      { status: 500 }
    );
  }
}
