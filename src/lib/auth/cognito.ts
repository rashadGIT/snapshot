/**
 * Cognito OAuth Helpers
 * Utilities for Cognito Hosted UI OAuth flow (Authorization Code + PKCE)
 */

import { randomBytes, createHash } from 'crypto';

// TEMPORARY HARDCODED VALUES FOR TESTING
// TODO: Remove this and fix Amplify environment variables
const HARDCODED_CONFIG = {
  COGNITO_CLIENT_ID: '2u118nfmdbm3ard5gjngiri760',
  NEXT_PUBLIC_COGNITO_DOMAIN: 'us-east-1w26khzfqu.auth.us-east-1.amazoncognito.com',
  COGNITO_REDIRECT_URI: 'https://master.d2sufnimjy7hms.amplifyapp.com/api/auth/callback',
  COGNITO_LOGOUT_URI: 'https://master.d2sufnimjy7hms.amplifyapp.com',
  COGNITO_CLIENT_SECRET: 'mmhotdq6evhj15ao6f6noslk7mile3spsps4dto62effv5juipc', // TODO: Replace with actual secret
};

// Read env vars at runtime, not at module load time
function getEnv(key: string): string {
  // Try env vars first
  const value = process.env[key] || process.env[`NEXT_PUBLIC_${key}`];

  // Fallback to hardcoded for testing
  if (!value && HARDCODED_CONFIG[key as keyof typeof HARDCODED_CONFIG]) {
    console.log(`Using hardcoded value for ${key} (env var not available)`);
    return HARDCODED_CONFIG[key as keyof typeof HARDCODED_CONFIG];
  }

  if (!value) {
    console.error(`Missing environment variable: ${key}`);
    console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('COGNITO')));
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
