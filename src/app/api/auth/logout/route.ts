/**
 * Logout endpoint
 * Clears session cookies and redirects to Cognito logout
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCognitoLogoutUrl } from '@/lib/auth/cognito';

export async function GET(request: NextRequest) {
  // Clear auth cookies
  const cookieStore = await cookies();
  cookieStore.delete('id_token');
  cookieStore.delete('access_token');

  // Redirect to Cognito logout
  const logoutUrl = getCognitoLogoutUrl();
  return NextResponse.redirect(logoutUrl);
}
