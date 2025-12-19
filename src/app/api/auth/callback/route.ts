/**
 * OAuth callback endpoint
 * Exchanges authorization code for tokens and creates/updates user
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeForTokens } from '@/lib/auth/cognito';
import { verifyCognitoToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

  if (!APP_URL) {
    throw new Error('NEXT_PUBLIC_APP_URL environment variable is required');
  }
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    return NextResponse.redirect(`${APP_URL}/?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${APP_URL}/?error=missing_code`);
  }

  try {
    // Retrieve PKCE code verifier from cookie
    const cookieStore = await cookies();
    const codeVerifier = cookieStore.get('pkce_verifier')?.value;

    if (!codeVerifier) {
      throw new Error('PKCE verifier not found');
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, codeVerifier);

    // Verify ID token
    const payload = await verifyCognitoToken(tokens.id_token);

    // Find or create user in database
    let user = await prisma.user.findUnique({
      where: { cognitoSub: payload.sub },
    });

    if (!user) {
      // First-time login: create user without role
      user = await prisma.user.create({
        data: {
          cognitoSub: payload.sub,
          email: payload.email || '',
          name: payload.name || payload['cognito:username'] || 'Unknown',
          authProvider: 'google',
          verificationStatus: 'verified',
          // role is null - must complete onboarding
        },
      });
    }

    // Store tokens in HTTP-only cookies
    cookieStore.set('id_token', tokens.id_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600, // 1 hour
      path: '/',
    });

    cookieStore.set('access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600,
      path: '/',
    });

    // Clear PKCE verifier
    cookieStore.delete('pkce_verifier');

    // Check if there's a pending join token (from QR scan)
    const pendingJoinToken = cookieStore.get('pending_join_token')?.value;

    if (pendingJoinToken) {
      // Clear the pending token
      cookieStore.delete('pending_join_token');
      // Redirect back to join flow
      return NextResponse.redirect(`${APP_URL}/join/${pendingJoinToken}`);
    }

    // Redirect based on activeRole
    if (!user.activeRole) {
      // No activeRole set - redirect to onboarding
      return NextResponse.redirect(`${APP_URL}/onboarding/role`);
    } else {
      // ActiveRole set - redirect to dashboard
      return NextResponse.redirect(`${APP_URL}/dashboard`);
    }
  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', errorMessage);
    return NextResponse.redirect(`${APP_URL}/?error=auth_failed&details=${encodeURIComponent(errorMessage)}`);
  }
}
