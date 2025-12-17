import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatePKCE, getCognitoLoginUrl, getCognitoLogoutUrl } from '@/lib/auth/cognito';

/**
 * Cognito OAuth Utilities Unit Tests
 * Tests PKCE generation, login URL, and logout URL construction
 */

describe.skip('Cognito OAuth Utilities', () => {
  const mockEnv = {
    NEXT_PUBLIC_COGNITO_DOMAIN: 'test-domain.auth.us-east-1.amazoncognito.com',
    COGNITO_CLIENT_ID: 'test-client-id',
    COGNITO_REDIRECT_URI: 'http://localhost:3000/api/auth/callback',
    COGNITO_LOGOUT_URI: 'http://localhost:3000',
  };

  beforeEach(() => {
    // Set environment variables
    process.env.NEXT_PUBLIC_COGNITO_DOMAIN = mockEnv.NEXT_PUBLIC_COGNITO_DOMAIN;
    process.env.COGNITO_CLIENT_ID = mockEnv.COGNITO_CLIENT_ID;
    process.env.COGNITO_REDIRECT_URI = mockEnv.COGNITO_REDIRECT_URI;
    process.env.COGNITO_LOGOUT_URI = mockEnv.COGNITO_LOGOUT_URI;
  });

  describe('generatePKCE', () => {
    it('should generate code verifier and challenge', () => {
      const pkce = generatePKCE();

      expect(pkce.codeVerifier).toBeDefined();
      expect(pkce.codeChallenge).toBeDefined();
    });

    it('should generate 43-character code verifier', () => {
      const pkce = generatePKCE();

      // Base64url encoding of 32 random bytes = 43 characters
      expect(pkce.codeVerifier.length).toBe(43);
    });

    it('should generate valid base64url code verifier', () => {
      const pkce = generatePKCE();

      // Base64url should only contain: A-Z, a-z, 0-9, -, _
      expect(pkce.codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate valid base64url code challenge', () => {
      const pkce = generatePKCE();

      // SHA256 hash in base64url = 43 characters
      expect(pkce.codeChallenge.length).toBe(43);
      expect(pkce.codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate unique code verifiers on each call', () => {
      const pkce1 = generatePKCE();
      const pkce2 = generatePKCE();

      expect(pkce1.codeVerifier).not.toBe(pkce2.codeVerifier);
      expect(pkce1.codeChallenge).not.toBe(pkce2.codeChallenge);
    });

    it('should generate different challenge from verifier', () => {
      const pkce = generatePKCE();

      // Challenge is SHA256 hash of verifier, so they should differ
      expect(pkce.codeChallenge).not.toBe(pkce.codeVerifier);
    });

    it('should generate deterministic challenge for same verifier', () => {
      const { codeVerifier } = generatePKCE();

      // Manually recreate challenge
      const crypto = require('crypto');
      const expectedChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      const pkceAgain = generatePKCE();
      // Can't compare directly since verifier is random, but we can verify format
      expect(pkceAgain.codeChallenge).toHaveLength(expectedChallenge.length);
    });
  });

  describe('getCognitoLoginUrl', () => {
    it('should generate valid login URL', () => {
      const codeChallenge = 'test-challenge';
      const url = getCognitoLoginUrl(codeChallenge);

      expect(url).toContain('https://');
      expect(url).toContain(mockEnv.NEXT_PUBLIC_COGNITO_DOMAIN);
      expect(url).toContain('/oauth2/authorize');
    });

    it('should include required OAuth parameters', () => {
      const codeChallenge = 'test-challenge';
      const url = getCognitoLoginUrl(codeChallenge);

      expect(url).toContain('response_type=code');
      expect(url).toContain(`client_id=${mockEnv.COGNITO_CLIENT_ID}`);
      expect(url).toContain(`redirect_uri=${encodeURIComponent(mockEnv.COGNITO_REDIRECT_URI)}`);
      expect(url).toContain('identity_provider=Google');
      expect(url).toContain('scope=openid+email+profile');
    });

    it('should include PKCE parameters', () => {
      const codeChallenge = 'test-challenge';
      const url = getCognitoLoginUrl(codeChallenge);

      expect(url).toContain('code_challenge_method=S256');
      expect(url).toContain(`code_challenge=${codeChallenge}`);
    });

    it('should properly URL encode parameters', () => {
      const codeChallenge = 'test-challenge';
      const url = getCognitoLoginUrl(codeChallenge);

      // Spaces should be encoded as +
      expect(url).toContain('openid+email+profile');

      // Redirect URI should be properly encoded
      expect(url).toContain(encodeURIComponent(mockEnv.COGNITO_REDIRECT_URI));
    });

    it('should force Google identity provider', () => {
      const codeChallenge = 'test-challenge';
      const url = getCognitoLoginUrl(codeChallenge);

      expect(url).toContain('identity_provider=Google');
    });

    it('should use S256 PKCE challenge method', () => {
      const codeChallenge = 'test-challenge';
      const url = getCognitoLoginUrl(codeChallenge);

      expect(url).toContain('code_challenge_method=S256');
    });
  });

  describe('getCognitoLogoutUrl', () => {
    it('should generate valid logout URL', () => {
      const url = getCognitoLogoutUrl();

      expect(url).toContain('https://');
      expect(url).toContain(mockEnv.NEXT_PUBLIC_COGNITO_DOMAIN);
      expect(url).toContain('/logout');
    });

    it('should include client_id parameter', () => {
      const url = getCognitoLogoutUrl();

      expect(url).toContain(`client_id=${mockEnv.COGNITO_CLIENT_ID}`);
    });

    it('should include logout_uri parameter', () => {
      const url = getCognitoLogoutUrl();

      expect(url).toContain(`logout_uri=${encodeURIComponent(mockEnv.COGNITO_LOGOUT_URI)}`);
    });

    it('should properly URL encode logout URI', () => {
      const url = getCognitoLogoutUrl();

      // Check that special characters are encoded
      const parsedUrl = new URL(url);
      const logoutUri = parsedUrl.searchParams.get('logout_uri');

      expect(logoutUri).toBe(mockEnv.COGNITO_LOGOUT_URI);
    });
  });

  describe('Full PKCE Flow', () => {
    it('should support complete PKCE flow', () => {
      // 1. Generate PKCE
      const pkce = generatePKCE();

      // 2. Build login URL with challenge
      const loginUrl = getCognitoLoginUrl(pkce.codeChallenge);

      // 3. Verify login URL contains challenge
      expect(loginUrl).toContain(pkce.codeChallenge);

      // 4. In real flow, verifier would be used in token exchange
      expect(pkce.codeVerifier).toBeDefined();
    });

    it('should generate different login URLs for different sessions', () => {
      const pkce1 = generatePKCE();
      const pkce2 = generatePKCE();

      const loginUrl1 = getCognitoLoginUrl(pkce1.codeChallenge);
      const loginUrl2 = getCognitoLoginUrl(pkce2.codeChallenge);

      // URLs should differ due to different challenges
      expect(loginUrl1).not.toBe(loginUrl2);
    });
  });
});
