/**
 * Cognito JWT Verification
 * Validates JWT tokens from Amazon Cognito using JWKS
 * Verifies: signature, issuer, audience, token_use, and expiration
 */

import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';

// TEMPORARY: Hardcoded fallbacks for Amplify Lambda environment
const FALLBACK_CONFIG: Record<string, string> = {
  COGNITO_REGION: 'us-east-1',
  COGNITO_USER_POOL_ID: 'us-east-1_w26khZFQU',
  COGNITO_CLIENT_ID: '2u118nfmdbm3ard5gjngiri760',
  COGNITO_ISSUER: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_w26khZFQU',
};

// Read env vars at runtime, not at module load time
function getEnv(key: string): string {
  const value = process.env[key] || process.env[`NEXT_PUBLIC_${key}`];

  // Use fallback if env var not found
  if (!value && FALLBACK_CONFIG[key]) {
    console.log(`Using hardcoded fallback for ${key}`);
    return FALLBACK_CONFIG[key];
  }

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

// Lazy-load JWKS to avoid module-time env var access
let JWKS: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS(): ReturnType<typeof createRemoteJWKSet> {
  if (!JWKS) {
    const COGNITO_REGION = getEnv('COGNITO_REGION');
    const COGNITO_USER_POOL_ID = getEnv('COGNITO_USER_POOL_ID');
    const JWKS_URI = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`;
    JWKS = createRemoteJWKSet(new URL(JWKS_URI));
  }
  return JWKS;
}

export interface CognitoTokenPayload extends JWTPayload {
  sub: string; // Cognito user ID
  email?: string;
  name?: string;
  'cognito:username'?: string;
  token_use: 'id' | 'access';
  auth_time: number;
  exp: number;
  iat: number;
  iss: string;
  aud?: string;
  client_id?: string;
}

/**
 * Verify a Cognito JWT token
 * Validates signature using JWKS, issuer, audience, token_use, and expiration
 */
export async function verifyCognitoToken(token: string): Promise<CognitoTokenPayload> {
  try {
    const COGNITO_ISSUER = getEnv('COGNITO_ISSUER');
    const COGNITO_CLIENT_ID = getEnv('COGNITO_CLIENT_ID');

    // Verify JWT signature and claims
    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: COGNITO_ISSUER,
      audience: COGNITO_CLIENT_ID,
    });

    const cognitoPayload = payload as CognitoTokenPayload;

    // Validate token_use (must be 'id' for ID tokens)
    if (cognitoPayload.token_use !== 'id') {
      throw new Error(`Invalid token_use: expected 'id', got '${cognitoPayload.token_use}'`);
    }

    // Validate required claims
    if (!cognitoPayload.sub) {
      throw new Error('Missing required claim: sub');
    }

    return cognitoPayload;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`JWT verification failed: ${error.message}`);
    }
    throw new Error('JWT verification failed: Unknown error');
  }
}

/**
 * Extract token from Authorization header
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
