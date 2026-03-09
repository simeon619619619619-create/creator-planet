// ============================================================================
// STRIPE CLIENT
// Shared Stripe configuration for Edge Functions
// ============================================================================

import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';

/**
 * Get Stripe client instance
 * Uses STRIPE_SECRET_KEY from environment (never exposed to client)
 */
export function getStripeClient(): Stripe {
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

/**
 * Get Stripe webhook secret for signature verification
 */
export function getWebhookSecret(): string {
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  return secret;
}

// ============================================================================
// STRIPE CONFIGURATION CONSTANTS
// European Fashion Institute Account (acct_1Sra05HH4asvT4B6)
// ============================================================================

/**
 * Stripe product and price configuration
 * All IDs are for the European Fashion Institute account (live mode)
 */
export const STRIPE_CONFIG = {
  activation: {
    productId: 'prod_U7OhnGQypJ2jxm',
    priceId: 'price_1T99uIHH4asvT4B64GBdjLWI',
    amount: 990,
  },
  plans: {
    starter: {
      productId: null,
      priceId: null,
      monthlyAmount: 0,
      platformFeePercent: 6.9,
    },
    pro: {
      productId: 'prod_U7OhXerO5LD9ZL',
      priceId: 'price_1T99uJHH4asvT4B6iDDYERzT',
      monthlyAmount: 3000,
      platformFeePercent: 3.9,
    },
    scale: {
      productId: 'prod_U7OhTEVS1XIzWU',
      priceId: 'price_1T99uJHH4asvT4B6dMW4xaK2',
      monthlyAmount: 9900,
      platformFeePercent: 1.9,
    },
  },
} as const;

/**
 * Get the Stripe config (single business account, live mode only)
 */
export function getStripeConfig() {
  return STRIPE_CONFIG;
}

export type PlanTier = 'starter' | 'pro' | 'scale' | 'exclusive';
