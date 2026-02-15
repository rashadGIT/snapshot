/**
 * Cognito OAuth Helpers
 * Utilities for Cognito Hosted UI OAuth flow (Authorization Code + PKCE)
 */

import { randomBytes, createHash } from 'crypto';
import { logger } from '@/lib/utils/logger';

// NOTE: All config values come from environment variables
// Fallbacks removed - environment variables are REQUIRED

// Read env vars at runtime, not at module load time
function getEnv(key: string): string {
  const directValue = process.env[key];
  const publicValue = process.env[`NEXT_PUBLIC_${key}`];
  const value = directValue || publicValue;

  // Enhanced debug logging
  logger.info(`getEnv('${key}'):`, {
    key,
    directKey: key,
    publicKey: `NEXT_PUBLIC_${key}`,
    directValue: directValue?.substring(0, 20),
    publicValue: publicValue?.substring(0, 20),
    foundDirect: !!directValue,
    foundPublic: !!publicValue,
    finalValue: value?.substring(0, 20),
    found: !!value,
  });

  if (!value) {
    throw new Error(`Missing environment variable: ${key}. This should be set in Amplify environment variables.`);
  }
  return value;
}

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
  // Direct access with NEXT_PUBLIC_ prefix (verified to work in Amplify SSR)
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI;
  const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;

  if (!clientId || !redirectUri || !domain) {
    throw new Error(`Missing required environment variables. Has: clientId=${!!clientId}, redirectUri=${!!redirectUri}, domain=${!!domain}`);
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    identity_provider: 'Google', // Force Google login
    scope: 'openid email profile',
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  });

  return `https://${domain}/oauth2/authorize?${params.toString()}`;
}

/**
 * Build Cognito logout URL
 */
export function getCognitoLogoutUrl(): string {
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!;
  const logoutUri = process.env.NEXT_PUBLIC_COGNITO_LOGOUT_URI!;
  const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN!;

  const params = new URLSearchParams({
    client_id: clientId,
    logout_uri: logoutUri,
  });

  return `https://${domain}/logout?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<{ id_token: string; access_token: string; refresh_token: string }> {
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!;
  const clientSecret = process.env.NEXT_PUBLIC_COGNITO_CLIENT_SECRET!;
  const redirectUri = process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI!;
  const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN!;

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
  });

  const response = await fetch(`https://${domain}/oauth2/token`, {
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
