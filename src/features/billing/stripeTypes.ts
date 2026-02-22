// ============================================================================
// STRIPE SERVICE TYPES
// TypeScript interfaces for Stripe integration
// ============================================================================

import type { Stripe as StripeJS } from '@stripe/stripe-js';

// ============================================================================
// PLAN & PRICING TYPES
// ============================================================================

export type PlanTier = 'starter' | 'pro' | 'scale' | 'exclusive';

export type BillingStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

export type TransactionType =
  | 'activation_fee'
  | 'subscription'
  | 'platform_fee'
  | 'refund'
  | 'payout'
  | 'adjustment';

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded';

// ============================================================================
// STRIPE CONFIGURATION
// ============================================================================

/**
 * Stripe product and price configuration
 * These IDs should match what's created in Stripe Dashboard
 */
export interface StripeConfig {
  activation: {
    productId: string;
    priceId: string;
    amount: number; // in cents (990 = €9.90)
    type: 'one_time';
  };
  plans: {
    starter: {
      productId: null;
      priceId: null;
      monthlyAmount: 0;
      platformFeePercent: 6.9;
    };
    pro: {
      productId: string;
      priceId: string;
      monthlyAmount: number; // in cents (3000 = €30)
      platformFeePercent: 3.9;
    };
    scale: {
      productId: string;
      priceId: string;
      monthlyAmount: number; // in cents (9900 = €99)
      platformFeePercent: 1.9;
    };
  };
}

/**
 * Default configuration - IDs should be overridden from environment
 */
export const STRIPE_CONFIG: StripeConfig = {
  activation: {
    productId: 'prod_Tm3yvErLQFwjjM',
    priceId: 'price_1Sput3EHrm7Q2JInE9dmsu4c',
    amount: 990,
    type: 'one_time',
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
};

// ============================================================================
// BILLING PLAN TYPES
// ============================================================================

export interface PlanFeatures {
  max_students: number; // -1 = unlimited
  max_courses: number; // -1 = unlimited
  max_communities: number; // -1 = unlimited
  ai_enabled: boolean;
  custom_branding: boolean;
  priority_support: boolean;
  white_label: boolean;
  advanced_analytics: boolean;
  api_access: boolean;
}

export interface BillingPlan {
  id: string;
  tier: PlanTier;
  name: string;
  description: string | null;
  price_monthly_cents: number;
  platform_fee_percent: number;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  features: PlanFeatures;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CREATOR BILLING TYPES
// ============================================================================

export interface CreatorBilling {
  id: string;
  creator_id: string;
  plan_id: string;
  status: BillingStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_account_id: string | null;
  stripe_account_status: string | null;
  has_first_sale: boolean;
  first_sale_at: string | null;
  monthly_fee_active: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  activation_fee_paid: boolean;
  activation_fee_paid_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  plan?: BillingPlan;
}

// ============================================================================
// TRANSACTION TYPES
// ============================================================================

export interface BillingTransaction {
  id: string;
  creator_id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount_cents: number;
  currency: string;
  description: string | null;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  related_sale_id: string | null;
  related_subscription_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  processed_at: string | null;
}

// ============================================================================
// SALES TYPES
// ============================================================================

export type ProductType = 'course' | 'membership' | 'product';

export interface CreatorSale {
  id: string;
  creator_id: string;
  buyer_id: string | null;
  product_type: ProductType;
  product_id: string | null;
  product_name: string;
  sale_amount_cents: number;
  platform_fee_cents: number;
  stripe_fee_cents: number;
  net_amount_cents: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  status: TransactionStatus;
  refunded_at: string | null;
  created_at: string;
  completed_at: string | null;
}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

export interface WebhookEvent {
  id: string;
  stripe_event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  processed: boolean;
  processed_at: string | null;
  error: string | null;
  created_at: string;
}

/**
 * Stripe webhook event types we handle
 */
export type HandledWebhookEvent =
  // Checkout & Payments
  | 'checkout.session.completed'
  | 'checkout.session.expired'
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  // Subscriptions
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'customer.subscription.trial_will_end'
  // Invoices
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'invoice.upcoming'
  // Connect
  | 'account.updated'
  | 'account.application.deauthorized'
  | 'payout.paid'
  | 'payout.failed'
  // Disputes
  | 'charge.dispute.created'
  | 'charge.dispute.closed';

// ============================================================================
// CHECKOUT SESSION TYPES
// ============================================================================

export interface ActivationCheckoutParams {
  creatorId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface SubscriptionCheckoutParams {
  creatorId: string;
  planId: PlanTier;
  customerId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface SaleCheckoutParams {
  creatorId: string;
  buyerId: string;
  product: {
    type: ProductType;
    id: string;
    name: string;
    price: number; // in cents
  };
  creatorStripeAccountId: string;
}

// ============================================================================
// CONNECT ACCOUNT TYPES
// ============================================================================

export type SupportedCountry = 'BG' | 'DE' | 'FR' | 'ES' | 'IT' | 'NL' | 'AT' | 'BE';

export interface ConnectAccountConfig {
  type: 'express';
  country: SupportedCountry;
  capabilities: {
    card_payments: { requested: true };
    transfers: { requested: true };
  };
  business_type: 'individual' | 'company';
  metadata: {
    creator_id: string;
    platform: 'creator_club';
  };
}

export interface ConnectAccountStatus {
  accountId: string;
  status: 'pending' | 'active' | 'restricted' | 'disabled';
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  requirements?: {
    currentlyDue: string[];
    eventuallyDue: string[];
    pendingVerification: string[];
    disabledReason: string | null;
  };
}

// ============================================================================
// SERVICE RESPONSE TYPES
// ============================================================================

export interface CheckoutResult {
  success: boolean;
  checkoutUrl?: string;
  sessionId?: string;
  error?: string;
}

export interface SubscriptionResult {
  success: boolean;
  subscriptionId?: string;
  checkoutUrl?: string;
  error?: string;
}

export interface PlanChangeResult {
  success: boolean;
  effectiveDate?: string;
  checkoutUrl?: string;
  requiresCheckout?: boolean;
  error?: string;
}

export interface ConnectOnboardingResult {
  success: boolean;
  accountId?: string;
  onboardingUrl?: string;
  error?: string;
}

export interface PaymentIntentResult {
  success: boolean;
  clientSecret?: string;
  paymentIntentId?: string;
  error?: string;
}

export interface FeeCalculation {
  feeAmount: number; // in cents
  feePercent: number;
  netAmount: number; // in cents (sale amount - platform fee)
}

// ============================================================================
// DISPLAY TYPES
// ============================================================================

export interface PlanDisplayInfo {
  tier: PlanTier;
  name: string;
  priceMonthly: string; // Formatted: "€30"
  platformFee: string; // Formatted: "3.9%"
  features: string[]; // Human-readable feature list
  recommended?: boolean;
  breakEvenRevenue?: string; // "€750/month"
}

export interface BillingDashboardData {
  currentPlan: BillingPlan;
  billing: CreatorBilling;
  currentPeriodRevenue: number; // This month's sales in cents
  platformFeesThisPeriod: number; // Fees taken this period in cents
  totalRevenue: number; // All-time in cents
  recentTransactions: BillingTransaction[];
  nextInvoiceDate: string | null;
  nextInvoiceAmount: number | null; // in cents
}

// ============================================================================
// UPGRADE PROMPT TYPES
// ============================================================================

export type UpgradeReason =
  | 'course_limit'
  | 'student_limit'
  | 'community_limit'
  | 'custom_branding'
  | 'white_label'
  | 'advanced_analytics'
  | 'api_access'
  | 'priority_support';

export interface UpgradePromptInfo {
  reason: UpgradeReason;
  title: string;
  description: string;
  currentUsage?: {
    current: number;
    max: number;
  };
  recommendedPlan: PlanTier;
}

export const UPGRADE_MESSAGES: Record<UpgradeReason, { title: string; description: string }> = {
  course_limit: {
    title: 'Course Limit Reached',
    description: 'Upgrade to Pro to create up to 10 courses, or Scale for unlimited.',
  },
  student_limit: {
    title: 'Student Limit Reached',
    description: 'Your community is growing! Upgrade to Pro for 500 students or Scale for unlimited.',
  },
  community_limit: {
    title: 'Community Limit Reached',
    description: 'Upgrade to Pro for up to 3 communities, or Scale for unlimited.',
  },
  custom_branding: {
    title: 'Custom Branding',
    description: 'Remove Creator Club branding and add your own logo. Available on Pro and Scale plans.',
  },
  white_label: {
    title: 'White Label',
    description: 'Fully customizable experience with your own domain. Available on Scale plan.',
  },
  advanced_analytics: {
    title: 'Advanced Analytics',
    description: 'Get detailed insights into your student engagement and revenue. Available on Pro and Scale plans.',
  },
  api_access: {
    title: 'API Access',
    description: 'Integrate with your own tools and automate workflows. Available on Scale plan.',
  },
  priority_support: {
    title: 'Priority Support',
    description: 'Get faster response times and dedicated support. Available on Pro and Scale plans.',
  },
};

// ============================================================================
// PLAN LIMITS CONFIGURATION
// ============================================================================

export const PLAN_LIMITS: Record<PlanTier, PlanFeatures> = {
  starter: {
    max_students: 50,
    max_courses: 2,
    max_communities: 1,
    ai_enabled: true,
    custom_branding: false,
    priority_support: false,
    white_label: false,
    advanced_analytics: false,
    api_access: false,
  },
  pro: {
    max_students: 500,
    max_courses: 10,
    max_communities: 3,
    ai_enabled: true,
    custom_branding: true,
    priority_support: true,
    white_label: false,
    advanced_analytics: true,
    api_access: false,
  },
  scale: {
    max_students: -1, // Unlimited
    max_courses: -1,
    max_communities: -1,
    ai_enabled: true,
    custom_branding: true,
    priority_support: true,
    white_label: true,
    advanced_analytics: true,
    api_access: true,
  },
  exclusive: {
    max_students: -1, // Unlimited
    max_courses: -1,
    max_communities: -1,
    ai_enabled: true,
    custom_branding: true,
    priority_support: true,
    white_label: true,
    advanced_analytics: true,
    api_access: true,
  },
};

// ============================================================================
// STRIPE CLIENT TYPE RE-EXPORT
// ============================================================================

export type StripeClient = StripeJS;
