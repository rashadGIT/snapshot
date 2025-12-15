/**
 * Pricing tiers for jobs
 * Maps price tier strings to dollar amounts
 */

export const PRICE_TIERS = {
  basic: 50,
  standard: 100,
  premium: 200,
} as const;

export type PriceTier = keyof typeof PRICE_TIERS;

export function getPriceAmount(tier: string): number {
  const normalizedTier = tier.toLowerCase() as PriceTier;
  return PRICE_TIERS[normalizedTier] || 0;
}

export function formatPrice(amount: number): string {
  return `$${amount}`;
}

export function getPriceDisplay(tier: string): string {
  const amount = getPriceAmount(tier);
  return `${formatPrice(amount)} (${tier})`;
}
