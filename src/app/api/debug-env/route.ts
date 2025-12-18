/**
 * Debug endpoint to check environment variables
 * DELETE THIS FILE AFTER DEBUGGING
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasCognitoClientId: !!process.env.COGNITO_CLIENT_ID,
    hasCognitoDomain: !!process.env.NEXT_PUBLIC_COGNITO_DOMAIN,
    hasCognitoSecret: !!process.env.COGNITO_CLIENT_SECRET,
    hasRedirectUri: !!process.env.COGNITO_REDIRECT_URI,
    hasLogoutUri: !!process.env.COGNITO_LOGOUT_URI,
    // Show first few chars to verify they're set
    clientIdPreview: process.env.COGNITO_CLIENT_ID?.substring(0, 5) || 'missing',
    domainPreview: process.env.NEXT_PUBLIC_COGNITO_DOMAIN?.substring(0, 10) || 'missing',
  });
}
