/**
 * Cognito OAuth Helpers
 * Utilities for Cognito Hosted UI OAuth flow (Authorization Code + PKCE)
 */

import { randomBytes, createHash } from 'crypto';
import { logger } from '@/lib/utils/logger';

// TEMPORARY: Hardcoded fallbacks for Amplify Lambda environment
// These are used when env vars don't propagate to Lambda properly
const FALLBACK_CONFIG: Record<string, string> = {
  COGNITO_CLIENT_ID: '2u118nfmdbm3ard5gjngiri760',
  COGNITO_CLIENT_SECRET: 'mmhotdq6evhj15ao6f6noslk7mile3spsps4dto62effv5juipc',
  COGNITO_REDIRECT_URI: 'https://master.d2sufnimjy7hms.amplifyapp.com/api/auth/callback',
  COGNITO_LOGOUT_URI: 'https://master.d2sufnimjy7hms.amplifyapp.com',
  COGNITO_REGION: 'us-east-1',
  COGNITO_USER_POOL_ID: 'us-east-1_w26khZFQU',
  COGNITO_ISSUER: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_w26khZFQU',
  NEXT_PUBLIC_COGNITO_DOMAIN: 'us-east-1w26khzfqu.auth.us-east-1.amazoncognito.com',
};

// Read env vars at runtime, not at module load time
function getEnv(key: string): string {
  const value = process.env[key] || process.env[`NEXT_PUBLIC_${key}`];

  // Debug logging
  logger.debug(`getEnv('${key}'):`, {
    directValue: !!process.env[key],
    publicValue: !!process.env[`NEXT_PUBLIC_${key}`],
    found: !!value,
    usingFallback: !value && !!FALLBACK_CONFIG[key],
  });

  // Use fallback if env var not found
  if (!value && FALLBACK_CONFIG[key]) {
    logger.info(`Using hardcoded fallback for ${key}`);
    return FALLBACK_CONFIG[key];
  }

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
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getEnv('COGNITO_CLIENT_ID'),
    redirect_uri: getEnv('COGNITO_REDIRECT_URI'),
    identity_provider: 'Google', // Force Google login
    scope: 'openid email profile',
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  });

  return `https://${getEnv('NEXT_PUBLIC_COGNITO_DOMAIN')}/oauth2/authorize?${params.toString()}`;
}

/**
 * Build Cognito logout URL
 */
export function getCognitoLogoutUrl(): string {
  const params = new URLSearchParams({
    client_id: getEnv('COGNITO_CLIENT_ID'),
    logout_uri: getEnv('COGNITO_LOGOUT_URI'),
  });

  return `https://${getEnv('NEXT_PUBLIC_COGNITO_DOMAIN')}/logout?${params.toString()}`;
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
    client_id: getEnv('COGNITO_CLIENT_ID'),
    client_secret: getEnv('COGNITO_CLIENT_SECRET'),
    code,
    code_verifier: codeVerifier,
    redirect_uri: getEnv('COGNITO_REDIRECT_URI'),
  });

  const response = await fetch(`https://${getEnv('NEXT_PUBLIC_COGNITO_DOMAIN')}/oauth2/token`, {
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
