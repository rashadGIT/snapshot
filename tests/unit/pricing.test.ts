import { describe, it, expect } from 'vitest';
import { getPriceAmount, formatPrice, PRICE_TIERS } from '@/lib/pricing';

describe.skip('Pricing Utilities', () => {
  describe('getPriceAmount', () => {
    it('should return correct price for basic tier', () => {
      expect(getPriceAmount('basic')).toBe(50);
    });

    it('should return correct price for standard tier', () => {
      expect(getPriceAmount('standard')).toBe(100);
    });

    it('should return correct price for premium tier', () => {
      expect(getPriceAmount('premium')).toBe(200);
    });

    it('should handle case-insensitive tier names', () => {
      expect(getPriceAmount('BASIC')).toBe(50);
      expect(getPriceAmount('Basic')).toBe(50);
    });

    it('should return 0 for invalid tier', () => {
      expect(getPriceAmount('invalid')).toBe(0);
    });
  });

  describe('formatPrice', () => {
    it('should format price as string', () => {
      expect(formatPrice(50)).toBe('50');
      expect(formatPrice(100)).toBe('100');
      expect(formatPrice(200)).toBe('200');
    });

    it('should handle zero', () => {
      expect(formatPrice(0)).toBe('0');
    });
  });

  describe('PRICE_TIERS', () => {
    it('should have all required tiers', () => {
      expect(PRICE_TIERS).toHaveProperty('basic');
      expect(PRICE_TIERS).toHaveProperty('standard');
      expect(PRICE_TIERS).toHaveProperty('premium');
    });
  });
});
