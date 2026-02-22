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
// KINGDOM LTD Business Account (acct_1SoV6VEHrm7Q2JIn)
// ============================================================================

/**
 * Stripe product and price configuration
 * All IDs are for the KINGDOM LTD business account (live mode)
 */
export const STRIPE_CONFIG = {
  activation: {
    productId: 'prod_Tm3yvErLQFwjjM',
    priceId: 'price_1Sput3EHrm7Q2JInE9dmsu4c',
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
      productId: 'prod_Tm3yo6o2IkxEjW',
      priceId: 'price_1SoVqmEHrm7Q2JIncZnyu9SY',
      monthlyAmount: 3000,
      platformFeePercent: 3.9,
    },
    scale: {
      productId: 'prod_Tm3yyZw4qEQRGI',
      priceId: 'price_1SoVqmEHrm7Q2JInneH7wG9d',
      monthlyAmount: 9900,
      platformFeePercent: 1.9,
    },
  },
  studentPlus: {
    productId: 'prod_Tm3yaCvF6DUXMN',
    priceId: 'price_1SoVqnEHrm7Q2JInAADYSo3z',
    monthlyAmount: 990,
  },
} as const;

/**
 * Get the Stripe config (single business account, live mode only)
 */
export function getStripeConfig() {
  return STRIPE_CONFIG;
}

export type PlanTier = 'starter' | 'pro' | 'scale' | 'exclusive';
