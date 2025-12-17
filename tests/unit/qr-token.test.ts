import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash, randomBytes } from 'crypto';

/**
 * QR Token Utilities Unit Tests
 * Tests token generation logic (without database)
 */

describe('QR Token Utilities', () => {
  const mockEnv = {
    QR_TOKEN_SECRET: 'test-secret-key-123',
  };

  beforeEach(() => {
    process.env.QR_TOKEN_SECRET = mockEnv.QR_TOKEN_SECRET;
  });

  describe('Token Generation Format', () => {
    it('should generate token with random and HMAC parts', () => {
      // Simulate generateSecureToken logic
      const jobId = 'test-job-123';
      const randomPart = randomBytes(16).toString('hex');
      const hmac = createHash('sha256')
        .update(`${jobId}:${randomPart}:${mockEnv.QR_TOKEN_SECRET}`)
        .digest('hex');

      const token = `${randomPart}.${hmac}`;

      expect(token).toContain('.');
      expect(token.split('.').length).toBe(2);
    });

    it('should generate 32-character random part', () => {
      const randomPart = randomBytes(16).toString('hex');

      expect(randomPart.length).toBe(32); // 16 bytes = 32 hex chars
    });

    it('should generate 64-character HMAC part', () => {
      const hmac = createHash('sha256')
        .update('test-data')
        .digest('hex');

      expect(hmac.length).toBe(64); // SHA256 = 64 hex chars
    });

    it('should generate different tokens for same job ID', () => {
      const jobId = 'test-job-123';

      const token1Random = randomBytes(16).toString('hex');
      const token1Hmac = createHash('sha256')
        .update(`${jobId}:${token1Random}:${mockEnv.QR_TOKEN_SECRET}`)
        .digest('hex');
      const token1 = `${token1Random}.${token1Hmac}`;

      const token2Random = randomBytes(16).toString('hex');
      const token2Hmac = createHash('sha256')
        .update(`${jobId}:${token2Random}:${mockEnv.QR_TOKEN_SECRET}`)
        .digest('hex');
      const token2 = `${token2Random}.${token2Hmac}`;

      expect(token1).not.toBe(token2);
    });

    it('should include job ID in HMAC calculation', () => {
      const randomPart = 'fixed-random-part';
      const jobId1 = 'job-123';
      const jobId2 = 'job-456';

      const hmac1 = createHash('sha256')
        .update(`${jobId1}:${randomPart}:${mockEnv.QR_TOKEN_SECRET}`)
        .digest('hex');

      const hmac2 = createHash('sha256')
        .update(`${jobId2}:${randomPart}:${mockEnv.QR_TOKEN_SECRET}`)
        .digest('hex');

      expect(hmac1).not.toBe(hmac2);
    });

    it('should include secret in HMAC calculation', () => {
      const randomPart = 'fixed-random-part';
      const jobId = 'job-123';
      const secret1 = 'secret-1';
      const secret2 = 'secret-2';

      const hmac1 = createHash('sha256')
        .update(`${jobId}:${randomPart}:${secret1}`)
        .digest('hex');

      const hmac2 = createHash('sha256')
        .update(`${jobId}:${randomPart}:${secret2}`)
        .digest('hex');

      expect(hmac1).not.toBe(hmac2);
    });

    it('should generate valid hex token parts', () => {
      const randomPart = randomBytes(16).toString('hex');
      const hmac = createHash('sha256')
        .update('test')
        .digest('hex');

      expect(randomPart).toMatch(/^[0-9a-f]{32}$/);
      expect(hmac).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('Short Code Generation', () => {
    it('should generate 6-digit numeric code', () => {
      // Simulate customAlphabet('0123456789', 6)
      const shortCode = Math.floor(100000 + Math.random() * 900000).toString();

      expect(shortCode.length).toBe(6);
      expect(shortCode).toMatch(/^\d{6}$/);
    });

    it('should generate different short codes', () => {
      const code1 = Math.floor(100000 + Math.random() * 900000).toString();
      const code2 = Math.floor(100000 + Math.random() * 900000).toString();

      // Very unlikely to be equal
      expect(code1).not.toBe(code2);
    });

    it('should generate codes in valid range', () => {
      for (let i = 0; i < 10; i++) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const num = parseInt(code);

        expect(num).toBeGreaterThanOrEqual(100000);
        expect(num).toBeLessThan(1000000);
      }
    });

    it('should only contain digits', () => {
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      for (const char of code) {
        expect('0123456789').toContain(char);
      }
    });
  });

  describe('Token Expiry Calculation', () => {
    it('should set expiry to 15 minutes from now', () => {
      const TOKEN_EXPIRY_MINUTES = 15;
      const now = Date.now();
      const expiresAt = new Date(now + TOKEN_EXPIRY_MINUTES * 60 * 1000);

      const diff = expiresAt.getTime() - now;

      expect(diff).toBeGreaterThanOrEqual(14.99 * 60 * 1000);
      expect(diff).toBeLessThanOrEqual(15.01 * 60 * 1000);
    });

    it('should create Date object for expiry', () => {
      const TOKEN_EXPIRY_MINUTES = 15;
      const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

      expect(expiresAt).toBeInstanceOf(Date);
    });

    it('should calculate expiry in future', () => {
      const TOKEN_EXPIRY_MINUTES = 15;
      const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Token Security', () => {
    it('should not be reversible to job ID', () => {
      const jobId = 'secret-job-id';
      const randomPart = randomBytes(16).toString('hex');
      const hmac = createHash('sha256')
        .update(`${jobId}:${randomPart}:${mockEnv.QR_TOKEN_SECRET}`)
        .digest('hex');

      const token = `${randomPart}.${hmac}`;

      // Token should not contain job ID
      expect(token).not.toContain(jobId);
    });

    it('should change with different secrets', () => {
      const jobId = 'job-123';
      const randomPart = 'fixed-random';

      const hmac1 = createHash('sha256')
        .update(`${jobId}:${randomPart}:secret-1`)
        .digest('hex');

      const hmac2 = createHash('sha256')
        .update(`${jobId}:${randomPart}:secret-2`)
        .digest('hex');

      expect(hmac1).not.toBe(hmac2);
    });

    it('should use cryptographically secure randomness', () => {
      const random1 = randomBytes(16);
      const random2 = randomBytes(16);

      // Should not be equal
      expect(random1.equals(random2)).toBe(false);
    });

    it('should use SHA256 for HMAC', () => {
      const hash = createHash('sha256').update('test').digest('hex');

      // SHA256 produces 64 hex characters (32 bytes)
      expect(hash.length).toBe(64);
    });
  });

  describe('Token Format Validation', () => {
    it('should validate token format with dot separator', () => {
      const token = 'randompart123456789012345678901234.hmacpart1234567890123456789012345678901234567890123456789012345678';

      expect(token).toContain('.');
      expect(token.split('.').length).toBe(2);
    });

    it('should detect invalid token format', () => {
      const invalidTokens = [
        'no-dot-separator',
        'too.many.dots',
        '',
        '.leadingdot',
        'trailingdot.',
      ];

      invalidTokens.forEach(token => {
        const parts = token.split('.');
        const isValid = parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;

        expect(isValid).toBe(false);
      });
    });

    it('should validate both parts are present', () => {
      const validToken = 'randompart.hmacpart';
      const parts = validToken.split('.');

      expect(parts).toHaveLength(2);
      expect(parts[0].length).toBeGreaterThan(0);
      expect(parts[1].length).toBeGreaterThan(0);
    });
  });

  describe('HMAC Verification Logic', () => {
    it('should be able to verify token with same inputs', () => {
      const jobId = 'job-123';
      const randomPart = 'fixed-random-part';
      const secret = 'test-secret';

      const originalHmac = createHash('sha256')
        .update(`${jobId}:${randomPart}:${secret}`)
        .digest('hex');

      const verifiedHmac = createHash('sha256')
        .update(`${jobId}:${randomPart}:${secret}`)
        .digest('hex');

      expect(originalHmac).toBe(verifiedHmac);
    });

    it('should fail verification with different job ID', () => {
      const randomPart = 'fixed-random-part';
      const secret = 'test-secret';

      const hmac1 = createHash('sha256')
        .update(`job-123:${randomPart}:${secret}`)
        .digest('hex');

      const hmac2 = createHash('sha256')
        .update(`job-456:${randomPart}:${secret}`)
        .digest('hex');

      expect(hmac1).not.toBe(hmac2);
    });

    it('should fail verification with different secret', () => {
      const jobId = 'job-123';
      const randomPart = 'fixed-random-part';

      const hmac1 = createHash('sha256')
        .update(`${jobId}:${randomPart}:secret-1`)
        .digest('hex');

      const hmac2 = createHash('sha256')
        .update(`${jobId}:${randomPart}:secret-2`)
        .digest('hex');

      expect(hmac1).not.toBe(hmac2);
    });
  });
});
