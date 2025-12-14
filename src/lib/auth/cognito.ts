/**
 * Cognito OAuth Helpers
 * Utilities for Cognito Hosted UI OAuth flow (Authorization Code + PKCE)
 */

import { randomBytes, createHash } from 'crypto';

const COGNITO_DOMAIN = process.env.NEXT_PUBLIC_COGNITO_DOMAIN!;
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID!;
const COGNITO_CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET!;
const REDIRECT_URI = process.env.COGNITO_REDIRECT_URI!;
const LOGOUT_URI = process.env.COGNITO_LOGOUT_URI!;

/**
 * Generate PKCE code verifier and challenge
 * Code verifier: 43-128 character random string
 * Code challenge: Base64-URL-encoded SHA256 hash of verifier
 */
export function generatePKCE() {
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return { codeVerifier, codeChallenge };
}

/**
 * Build Cognito Hosted UI login URL
 */
export function getCognitoLoginUrl(codeChallenge: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: COGNITO_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    identity_provider: 'Google', // Force Google login
    scope: 'openid email profile',
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  });

  return `https://${COGNITO_DOMAIN}/oauth2/authorize?${params.toString()}`;
}

/**
 * Build Cognito logout URL
 */
export function getCognitoLogoutUrl(): string {
  const params = new URLSearchParams({
    client_id: COGNITO_CLIENT_ID,
    logout_uri: LOGOUT_URI,
  });

  return `https://${COGNITO_DOMAIN}/logout?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<{ id_token: string; access_token: string; refresh_token: string }> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: COGNITO_CLIENT_ID,
    client_secret: COGNITO_CLIENT_SECRET,
    code,
    code_verifier: codeVerifier,
    redirect_uri: REDIRECT_URI,
  });

  const response = await fetch(`https://${COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}
