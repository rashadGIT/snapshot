/**
 * Cognito JWT Verification
 * Validates JWT tokens from Amazon Cognito using JWKS
 * Verifies: signature, issuer, audience, token_use, and expiration
 */

import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';

const COGNITO_REGION = process.env.COGNITO_REGION!;
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID!;
const COGNITO_ISSUER = process.env.COGNITO_ISSUER!;

// JWKS endpoint for Cognito public keys
const JWKS_URI = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`;

// Create JWKS remote set (automatically fetches and caches public keys)
const JWKS = createRemoteJWKSet(new URL(JWKS_URI));

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
    // Verify JWT signature and claims
    const { payload } = await jwtVerify(token, JWKS, {
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
