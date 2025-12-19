/**
 * Login endpoint
 * Initiates Cognito Hosted UI OAuth flow with PKCE
 */

import { NextRequest, NextResponse } from 'next/server';
import { generatePKCE, getCognitoLoginUrl } from '@/lib/auth/cognito';
import { cookies } from 'next/headers';

// Force dynamic rendering (don't prerender at build time)
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
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
    console.error('Login error:', error);
    return NextResponse.json(
      {
        error: 'Login failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        env_check: {
          hasCognitoClientId: !!process.env.COGNITO_CLIENT_ID,
          hasCognitoDomain: !!process.env.NEXT_PUBLIC_COGNITO_DOMAIN,
          hasRedirectUri: !!process.env.COGNITO_REDIRECT_URI,
        }
      },
      { status: 500 }
    );
  }
}
