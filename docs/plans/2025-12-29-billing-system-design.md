# Billing System Architecture Design

**Date:** 2025-12-29
**Status:** ✅ IMPLEMENTED (Deployed 2025-12-30)
**Author:** Architect Agent
**Phase:** Phase 1 - Creator Plans (Starter/Pro/Scale)

---

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Database Schema | ✅ Deployed | Migration 011, 012 applied |
| Stripe Products | ✅ Created | prod_ThBhGe4gwluiQ8, prod_ThBhoMU9mCS03d, prod_ThBhNjnTJAQEFi |
| Edge Functions | ✅ Deployed | 6 functions ACTIVE on Supabase |
| Webhook | ✅ Live | we_1Sk4MdFbO001Rr4nPMqOLW9x (LIVE mode) |
| Frontend | ✅ Complete | OnboardingPage, BillingSettingsPage, stripeService |
| Secrets | ✅ Configured | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET |

---

## Overview

This document defines the complete billing system architecture for Creator Club. The system implements a hybrid pricing model with:

- **Fixed monthly fee** (only after first sale for Pro/Scale)
- **Percentage-based platform fee** on all sales
- **One-time activation fee** on registration

### Pricing Model Summary

| Plan | Monthly Fee | Platform Fee | Monthly Fee Trigger |
|------|-------------|--------------|---------------------|
| **Starter** | €0 | 6.9% | N/A (always free) |
| **Pro** | €30 | 3.9% | After 1st sale |
| **Scale** | €99 | 1.9% | After 1st sale |

- **Activation Fee:** €2.9 (one-time, on registration)
- **Break-even Points:** Starter→Pro at ~€750/mo revenue, Pro→Scale at ~€6,900/mo revenue

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Payment Processor | Stripe | Industry standard, already hinted in types, excellent API |
| Billing Model | Stripe Billing + Connect | Subscriptions for plans + Connect for marketplace fees |
| Fee Collection | Application fees on Connect | Automatic platform fee deduction on payouts |
| Monthly Fee Trigger | Database flag + Stripe webhook | Track first sale, then activate subscription |
| Currency | EUR (primary) | BG market focus, Stripe supports EUR |
| Subscription Billing | Monthly (no annual for MVP) | Simpler launch, annual can be added later |
| Plan Upgrades | Immediate proration | Better UX, immediate access to new features |
| Plan Downgrades | At period end | Prevents gaming the system |
| Invoice Storage | Stripe hosted | PCI compliant, no sensitive data in our DB |
| Webhook Security | Stripe signatures + idempotency keys | Prevent replay attacks, handle duplicates |

---

## Data Models

### 1. Database Schema

#### New Types

```sql
-- Plan tier types
CREATE TYPE plan_tier AS ENUM ('starter', 'pro', 'scale');

-- Subscription status types
CREATE TYPE billing_status AS ENUM (
  'trialing',           -- During activation/setup
  'active',             -- Subscription is active
  'past_due',           -- Payment failed, grace period
  'canceled',           -- User canceled
  'incomplete',         -- Initial payment pending
  'incomplete_expired', -- Initial payment failed
  'paused'              -- Temporarily paused (future use)
);

-- Transaction types
CREATE TYPE transaction_type AS ENUM (
  'activation_fee',     -- One-time €2.9 activation
  'subscription',       -- Monthly plan fee
  'platform_fee',       -- Percentage fee on creator sales
  'refund',             -- Any refund
  'payout',             -- Payout to creator (for records)
  'adjustment'          -- Manual adjustments
);

-- Transaction status
CREATE TYPE transaction_status AS ENUM (
  'pending',
  'completed',
  'failed',
  'refunded'
);
```

#### Table: `billing_plans`

Master plan configuration (seeded, rarely changed).

```sql
CREATE TABLE public.billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier plan_tier NOT NULL UNIQUE,
  name TEXT NOT NULL,                    -- "Starter", "Pro", "Scale"
  description TEXT,
  price_monthly_cents INTEGER NOT NULL,  -- 0, 3000, 9900 (in EUR cents)
  platform_fee_percent DECIMAL(4,2) NOT NULL, -- 6.90, 3.90, 1.90
  stripe_product_id TEXT,                -- Stripe Product ID (optional for Starter)
  stripe_price_id TEXT,                  -- Stripe Price ID (optional for Starter)
  features JSONB DEFAULT '{}'::jsonb,    -- Feature flags for plan
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX billing_plans_tier_idx ON public.billing_plans(tier);
CREATE INDEX billing_plans_is_active_idx ON public.billing_plans(is_active);

COMMENT ON TABLE public.billing_plans IS 'Master plan configuration for Starter/Pro/Scale tiers';
COMMENT ON COLUMN public.billing_plans.price_monthly_cents IS 'Monthly price in EUR cents (0 for Starter)';
COMMENT ON COLUMN public.billing_plans.platform_fee_percent IS 'Platform fee percentage taken from creator sales';
```

#### Table: `creator_billing`

Creator-specific billing state (extends `creator_profiles`).

```sql
CREATE TABLE public.creator_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,

  -- Current plan state
  plan_id UUID REFERENCES public.billing_plans(id) NOT NULL,
  status billing_status DEFAULT 'trialing' NOT NULL,

  -- Stripe identifiers
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  stripe_account_id TEXT,              -- Stripe Connect account for payouts
  stripe_account_status TEXT,          -- 'pending', 'active', 'restricted'

  -- Billing triggers & state
  has_first_sale BOOLEAN DEFAULT false NOT NULL,
  first_sale_at TIMESTAMPTZ,
  monthly_fee_active BOOLEAN DEFAULT false NOT NULL,

  -- Period tracking
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,

  -- Cancellation
  cancel_at_period_end BOOLEAN DEFAULT false NOT NULL,
  canceled_at TIMESTAMPTZ,

  -- Activation
  activation_fee_paid BOOLEAN DEFAULT false NOT NULL,
  activation_fee_paid_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX creator_billing_creator_id_idx ON public.creator_billing(creator_id);
CREATE INDEX creator_billing_stripe_customer_id_idx ON public.creator_billing(stripe_customer_id);
CREATE INDEX creator_billing_stripe_account_id_idx ON public.creator_billing(stripe_account_id);
CREATE INDEX creator_billing_status_idx ON public.creator_billing(status);
CREATE INDEX creator_billing_plan_id_idx ON public.creator_billing(plan_id);

COMMENT ON TABLE public.creator_billing IS 'Creator billing state and Stripe integration data';
COMMENT ON COLUMN public.creator_billing.has_first_sale IS 'Triggers monthly fee activation for Pro/Scale';
COMMENT ON COLUMN public.creator_billing.stripe_account_id IS 'Stripe Connect account for receiving payouts';
```

#### Table: `billing_transactions`

Immutable ledger of all billing events.

```sql
CREATE TABLE public.billing_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Transaction details
  type transaction_type NOT NULL,
  status transaction_status DEFAULT 'pending' NOT NULL,
  amount_cents INTEGER NOT NULL,        -- Amount in EUR cents
  currency TEXT DEFAULT 'EUR' NOT NULL,
  description TEXT,

  -- Stripe references
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  stripe_charge_id TEXT,
  stripe_transfer_id TEXT,              -- For Connect payouts

  -- Related entities
  related_sale_id UUID,                 -- Reference to a course/product sale
  related_subscription_id TEXT,         -- Stripe subscription ID

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,   -- Additional context
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  processed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX billing_transactions_creator_id_idx ON public.billing_transactions(creator_id);
CREATE INDEX billing_transactions_type_idx ON public.billing_transactions(type);
CREATE INDEX billing_transactions_status_idx ON public.billing_transactions(status);
CREATE INDEX billing_transactions_created_at_idx ON public.billing_transactions(created_at DESC);
CREATE INDEX billing_transactions_stripe_payment_intent_idx ON public.billing_transactions(stripe_payment_intent_id);

COMMENT ON TABLE public.billing_transactions IS 'Immutable ledger of all billing transactions';
```

#### Table: `creator_sales`

Track creator product/course sales for platform fee calculation.

```sql
CREATE TABLE public.creator_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Sale details
  product_type TEXT NOT NULL,           -- 'course', 'membership', 'product'
  product_id UUID,                      -- Reference to specific product
  product_name TEXT NOT NULL,

  -- Amounts
  sale_amount_cents INTEGER NOT NULL,   -- Gross sale amount
  platform_fee_cents INTEGER NOT NULL,  -- Our cut (calculated from plan %)
  stripe_fee_cents INTEGER NOT NULL,    -- Stripe processing fee
  net_amount_cents INTEGER NOT NULL,    -- What creator receives
  currency TEXT DEFAULT 'EUR' NOT NULL,

  -- Stripe
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  stripe_transfer_id TEXT,              -- Transfer to creator's Connect account

  -- Status
  status transaction_status DEFAULT 'pending' NOT NULL,
  refunded_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX creator_sales_creator_id_idx ON public.creator_sales(creator_id);
CREATE INDEX creator_sales_buyer_id_idx ON public.creator_sales(buyer_id);
CREATE INDEX creator_sales_status_idx ON public.creator_sales(status);
CREATE INDEX creator_sales_created_at_idx ON public.creator_sales(created_at DESC);
CREATE INDEX creator_sales_product_type_idx ON public.creator_sales(product_type);

COMMENT ON TABLE public.creator_sales IS 'All creator sales with platform fee tracking';
```

#### Table: `webhook_events`

Idempotent webhook processing log.

```sql
CREATE TABLE public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,  -- Stripe event ID for idempotency
  event_type TEXT NOT NULL,               -- e.g., 'checkout.session.completed'
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false NOT NULL,
  processed_at TIMESTAMPTZ,
  error TEXT,                             -- Error message if processing failed
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX webhook_events_stripe_event_id_idx ON public.webhook_events(stripe_event_id);
CREATE INDEX webhook_events_event_type_idx ON public.webhook_events(event_type);
CREATE INDEX webhook_events_processed_idx ON public.webhook_events(processed);
CREATE INDEX webhook_events_created_at_idx ON public.webhook_events(created_at DESC);

COMMENT ON TABLE public.webhook_events IS 'Stripe webhook event log for idempotent processing';
```

### 2. TypeScript Types

Update `src/core/types.ts`:

```typescript
// ============================================================================
// BILLING & SUBSCRIPTION TYPES
// ============================================================================

export type PlanTier = 'starter' | 'pro' | 'scale';

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

export interface PlanFeatures {
  max_students: number;          // -1 = unlimited
  max_courses: number;           // -1 = unlimited
  max_communities: number;       // -1 = unlimited
  ai_enabled: boolean;
  custom_branding: boolean;
  priority_support: boolean;
  white_label: boolean;
  advanced_analytics: boolean;
  api_access: boolean;
}

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

export interface CreatorSale {
  id: string;
  creator_id: string;
  buyer_id: string | null;
  product_type: 'course' | 'membership' | 'product';
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

// Convenience types for UI
export interface PlanDisplayInfo {
  tier: PlanTier;
  name: string;
  priceMonthly: string;           // Formatted: "€30"
  platformFee: string;            // Formatted: "3.9%"
  features: string[];             // Human-readable feature list
  recommended?: boolean;
  breakEvenRevenue?: string;      // "€750/month"
}

export interface BillingDashboardData {
  currentPlan: BillingPlan;
  billing: CreatorBilling;
  currentPeriodRevenue: number;   // This month's sales
  platformFeesThisPeriod: number; // Fees taken this period
  totalRevenue: number;           // All-time
  recentTransactions: BillingTransaction[];
  nextInvoiceDate: string | null;
  nextInvoiceAmount: number | null;
}
```

---

## Stripe Integration Strategy

### 1. Stripe Products & Prices Setup

Create in Stripe Dashboard or via API during initialization:

```typescript
// Stripe Product & Price Configuration
const STRIPE_CONFIG = {
  activation: {
    productId: 'prod_activation_fee',
    priceId: 'price_activation_290_eur',
    amount: 290,  // €2.90
    type: 'one_time'
  },
  plans: {
    starter: {
      productId: null,  // No Stripe product needed for free tier
      priceId: null,
      monthlyAmount: 0,
      platformFeePercent: 6.9
    },
    pro: {
      productId: 'prod_creator_pro',
      priceId: 'price_pro_3000_eur_monthly',
      monthlyAmount: 3000,  // €30
      platformFeePercent: 3.9
    },
    scale: {
      productId: 'prod_creator_scale',
      priceId: 'price_scale_9900_eur_monthly',
      monthlyAmount: 9900,  // €99
      platformFeePercent: 1.9
    }
  }
};
```

### 2. Stripe Connect Configuration

Use **Stripe Connect Express** for marketplace functionality:

- Creators onboard via Stripe Express onboarding
- Platform collects payments, deducts fees, transfers remainder
- Automatic tax reporting and payouts

```typescript
// Connect account creation
interface ConnectAccountConfig {
  type: 'express';
  country: 'BG' | 'DE' | 'FR' | 'ES' | 'IT'; // Supported EU countries
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
```

### 3. Payment Flow Configurations

#### A) Activation Fee Checkout

```typescript
// One-time payment checkout session
const activationCheckout = {
  mode: 'payment',
  line_items: [{
    price: 'price_activation_290_eur',
    quantity: 1
  }],
  success_url: `${APP_URL}/onboarding/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${APP_URL}/onboarding/canceled`,
  metadata: {
    type: 'activation_fee',
    creator_id: creatorId
  }
};
```

#### B) Plan Subscription Checkout

```typescript
// Subscription checkout (triggered after first sale for Pro/Scale)
const subscriptionCheckout = {
  mode: 'subscription',
  line_items: [{
    price: planPriceId,  // 'price_pro_3000_eur_monthly' or 'price_scale_9900_eur_monthly'
    quantity: 1
  }],
  subscription_data: {
    metadata: {
      creator_id: creatorId,
      plan_tier: planTier
    }
  },
  success_url: `${APP_URL}/settings/billing?success=true`,
  cancel_url: `${APP_URL}/settings/billing?canceled=true`,
  customer: stripeCustomerId,
  metadata: {
    type: 'plan_subscription',
    creator_id: creatorId
  }
};
```

#### C) Creator Product Sale (Connect)

```typescript
// Payment for creator's product (course, membership, etc.)
const salePaymentIntent = {
  amount: saleAmountCents,
  currency: 'eur',
  application_fee_amount: platformFeeCents,  // Our cut
  transfer_data: {
    destination: creatorStripeAccountId  // Transfer to creator
  },
  metadata: {
    product_type: 'course',
    product_id: courseId,
    creator_id: creatorId,
    buyer_id: buyerId
  }
};
```

---

## Service Layer Design

### File: `src/services/billingService.ts`

```typescript
// ============================================================================
// BILLING SERVICE - Complete API for billing operations
// ============================================================================

import Stripe from 'stripe';
import { supabase } from '@/core/supabase/client';
import type {
  PlanTier,
  BillingPlan,
  CreatorBilling,
  BillingTransaction,
  CreatorSale,
  BillingDashboardData
} from '@/core/types';

// Initialize Stripe with secret key (server-side only)
const stripe = new Stripe(import.meta.env.VITE_STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

// ============================================================================
// PLAN OPERATIONS
// ============================================================================

/**
 * Get all available billing plans
 */
export async function getPlans(): Promise<BillingPlan[]>;

/**
 * Get a specific plan by tier
 */
export async function getPlanByTier(tier: PlanTier): Promise<BillingPlan | null>;

/**
 * Get plan features for display
 */
export function getPlanDisplayInfo(plan: BillingPlan): PlanDisplayInfo;

// ============================================================================
// CREATOR BILLING OPERATIONS
// ============================================================================

/**
 * Initialize billing for new creator (called during registration)
 * - Creates Stripe customer
 * - Creates creator_billing record with Starter plan
 * - Returns checkout URL for activation fee
 */
export async function initializeCreatorBilling(
  creatorId: string,
  email: string
): Promise<{ checkoutUrl: string; customerId: string }>;

/**
 * Get creator's current billing state
 */
export async function getCreatorBilling(
  creatorId: string
): Promise<CreatorBilling | null>;

/**
 * Get full billing dashboard data
 */
export async function getBillingDashboard(
  creatorId: string
): Promise<BillingDashboardData>;

/**
 * Create checkout session for activation fee
 */
export async function createActivationCheckout(
  creatorId: string
): Promise<string>; // Returns checkout URL

/**
 * Check if activation fee is paid
 */
export async function isActivationPaid(creatorId: string): Promise<boolean>;

// ============================================================================
// PLAN CHANGE OPERATIONS
// ============================================================================

/**
 * Upgrade creator to new plan
 * - Creates subscription if upgrading from Starter
 * - Prorates if upgrading between paid plans
 */
export async function upgradePlan(
  creatorId: string,
  newTier: PlanTier
): Promise<{ success: boolean; checkoutUrl?: string; error?: string }>;

/**
 * Downgrade creator to new plan (takes effect at period end)
 */
export async function downgradePlan(
  creatorId: string,
  newTier: PlanTier
): Promise<{ success: boolean; effectiveDate: string }>;

/**
 * Cancel subscription (takes effect at period end)
 */
export async function cancelSubscription(
  creatorId: string
): Promise<{ success: boolean; effectiveDate: string }>;

/**
 * Resume canceled subscription (before period end)
 */
export async function resumeSubscription(
  creatorId: string
): Promise<{ success: boolean }>;

// ============================================================================
// FIRST SALE TRIGGER
// ============================================================================

/**
 * Handle first sale - triggers monthly fee for Pro/Scale
 * Called when a creator makes their first successful sale
 */
export async function handleFirstSale(
  creatorId: string
): Promise<void>;

/**
 * Check and activate monthly fee if needed
 * Called after first sale is recorded
 */
export async function activateMonthlyFee(
  creatorId: string
): Promise<{ activated: boolean; checkoutUrl?: string }>;

// ============================================================================
// STRIPE CONNECT OPERATIONS
// ============================================================================

/**
 * Create Stripe Connect account for creator
 */
export async function createConnectAccount(
  creatorId: string,
  email: string,
  country: string
): Promise<{ accountId: string; onboardingUrl: string }>;

/**
 * Get Connect onboarding link (for incomplete onboarding)
 */
export async function getConnectOnboardingLink(
  creatorId: string
): Promise<string>;

/**
 * Check Connect account status
 */
export async function getConnectAccountStatus(
  creatorId: string
): Promise<{ status: string; payoutsEnabled: boolean; chargesEnabled: boolean }>;

// ============================================================================
// SALE PROCESSING
// ============================================================================

/**
 * Create payment intent for a creator's product sale
 */
export async function createSalePaymentIntent(
  creatorId: string,
  buyerId: string,
  product: { type: string; id: string; name: string; price: number }
): Promise<{ clientSecret: string; paymentIntentId: string }>;

/**
 * Record a completed sale
 */
export async function recordSale(
  saleData: Omit<CreatorSale, 'id' | 'created_at'>
): Promise<CreatorSale>;

/**
 * Calculate platform fee for a sale
 */
export async function calculatePlatformFee(
  creatorId: string,
  saleAmount: number
): Promise<{ feeAmount: number; feePercent: number }>;

// ============================================================================
// TRANSACTION HISTORY
// ============================================================================

/**
 * Get creator's transaction history
 */
export async function getTransactions(
  creatorId: string,
  options?: { limit?: number; offset?: number; type?: TransactionType }
): Promise<BillingTransaction[]>;

/**
 * Get creator's sales history
 */
export async function getSales(
  creatorId: string,
  options?: { limit?: number; offset?: number; startDate?: string; endDate?: string }
): Promise<CreatorSale[]>;

/**
 * Get revenue analytics
 */
export async function getRevenueAnalytics(
  creatorId: string,
  period: 'day' | 'week' | 'month' | 'year'
): Promise<{
  totalRevenue: number;
  platformFees: number;
  netRevenue: number;
  salesCount: number;
  averageSale: number;
}>;

// ============================================================================
// WEBHOOK HANDLERS
// ============================================================================

/**
 * Process Stripe webhook event
 */
export async function processWebhookEvent(
  event: Stripe.Event
): Promise<{ processed: boolean; error?: string }>;

/**
 * Individual webhook handlers
 */
export const webhookHandlers = {
  'checkout.session.completed': handleCheckoutComplete,
  'invoice.paid': handleInvoicePaid,
  'invoice.payment_failed': handlePaymentFailed,
  'customer.subscription.created': handleSubscriptionCreated,
  'customer.subscription.updated': handleSubscriptionUpdated,
  'customer.subscription.deleted': handleSubscriptionDeleted,
  'payment_intent.succeeded': handlePaymentSuccess,
  'payment_intent.payment_failed': handlePaymentFailed,
  'account.updated': handleConnectAccountUpdated,
  'payout.paid': handlePayoutPaid,
  'payout.failed': handlePayoutFailed
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format amount for display (cents to EUR string)
 */
export function formatAmount(cents: number, currency?: string): string;

/**
 * Get plan recommendation based on monthly revenue
 */
export function getRecommendedPlan(monthlyRevenue: number): PlanTier;

/**
 * Calculate break-even point for plan upgrade
 */
export function calculateBreakEven(
  currentTier: PlanTier,
  targetTier: PlanTier
): number;
```

---

## UI Components

### Component Structure

```
src/features/billing/
├── pages/
│   ├── PricingPage.tsx           # Public pricing display
│   ├── BillingSettingsPage.tsx   # Creator billing management
│   └── ActivationPage.tsx        # Activation fee payment flow
│
├── components/
│   ├── PlanCard.tsx              # Individual plan display card
│   ├── PlanComparison.tsx        # Side-by-side plan comparison
│   ├── CurrentPlanBadge.tsx      # Shows current plan status
│   ├── UpgradeModal.tsx          # Plan upgrade confirmation
│   ├── DowngradeModal.tsx        # Plan downgrade warning
│   ├── CancelModal.tsx           # Subscription cancellation
│   ├── BillingOverview.tsx       # Dashboard summary card
│   ├── TransactionHistory.tsx    # Transaction list
│   ├── RevenueChart.tsx          # Revenue visualization
│   ├── PaymentMethodCard.tsx     # Payment method display
│   ├── InvoiceList.tsx           # Past invoices
│   └── ConnectOnboarding.tsx     # Stripe Connect setup
│
├── hooks/
│   ├── useBilling.ts             # Main billing state hook
│   ├── usePlanLimits.ts          # Feature gating hook
│   ├── useStripeElements.ts      # Stripe Elements wrapper
│   └── useRevenue.ts             # Revenue analytics hook
│
└── index.ts                      # Public exports
```

### Component Responsibilities

#### PricingPage.tsx
- Display all plans with features
- Highlight recommended plan
- Show current plan (if logged in)
- CTA buttons for signup/upgrade
- FAQ section

#### BillingSettingsPage.tsx
- Current plan overview with usage stats
- Upgrade/downgrade options
- Payment method management
- Transaction history
- Invoice downloads
- Cancel subscription option

#### ActivationPage.tsx
- Activation fee explanation
- Stripe Checkout redirect
- Success/failure handling
- Onboarding continuation

#### PlanCard.tsx
```typescript
interface PlanCardProps {
  plan: BillingPlan;
  isCurrentPlan: boolean;
  isRecommended?: boolean;
  onSelect: (tier: PlanTier) => void;
  disabled?: boolean;
}
```

#### usePlanLimits.ts
```typescript
interface PlanLimits {
  canAddStudent: boolean;
  canAddCourse: boolean;
  canAddCommunity: boolean;
  hasAiAccess: boolean;
  hasCustomBranding: boolean;
  hasPrioritySupport: boolean;
  usage: {
    students: { current: number; max: number };
    courses: { current: number; max: number };
    communities: { current: number; max: number };
  };
  showUpgradePrompt: (feature: string) => void;
}

export function usePlanLimits(): PlanLimits;
```

---

## User Flows

### Flow 1: Creator Registration + Activation Fee

```
1. User signs up (email/password or OAuth)
   └─> Creates profile with role='creator'

2. Redirect to /onboarding/activation
   ├─> Show activation fee info (€2.9)
   ├─> Show value proposition
   └─> "Pay & Start" button

3. Click "Pay & Start"
   ├─> billingService.initializeCreatorBilling()
   │   ├─> Create Stripe Customer
   │   ├─> Create creator_billing (Starter plan, status='trialing')
   │   └─> Create Checkout Session (one-time €2.9)
   └─> Redirect to Stripe Checkout

4. Stripe Checkout
   ├─> Success → Redirect to /onboarding/success
   └─> Cancel → Redirect to /onboarding/canceled

5. Webhook: checkout.session.completed
   ├─> Record transaction (activation_fee)
   ├─> Update creator_billing (activation_fee_paid=true, status='active')
   └─> Send welcome email

6. /onboarding/success
   ├─> Verify activation complete
   ├─> Show Stripe Connect onboarding prompt
   └─> Continue to dashboard
```

### Flow 2: Plan Selection (During Onboarding or Settings)

```
1. View /pricing or /settings/billing
   └─> Display all plans with current highlighted

2. Select a plan
   ├─> Starter: No action needed (already default)
   ├─> Pro/Scale: Show confirmation modal
   │   ├─> "Monthly fee starts after your first sale"
   │   └─> Explain proration if upgrading between paid

3. Confirm upgrade (Pro/Scale)
   └─> billingService.upgradePlan()
       ├─> Update plan_id in creator_billing
       ├─> If has_first_sale: Create subscription immediately
       │   └─> Redirect to Stripe Checkout
       └─> If !has_first_sale: Just update plan, no charge yet
           └─> Show success: "You're now on Pro. Monthly fee activates after first sale."

4. Webhook (if subscription created)
   └─> customer.subscription.created
       └─> Update creator_billing with subscription details
```

### Flow 3: First Sale Trigger

```
1. Student purchases creator's course/product
   └─> billingService.createSalePaymentIntent()
       ├─> Calculate platform fee based on creator's plan
       └─> Return payment intent

2. Payment succeeds
   └─> Webhook: payment_intent.succeeded
       ├─> billingService.recordSale()
       │   └─> Create creator_sales record
       ├─> Create transaction (platform_fee)
       └─> If first sale:
           └─> billingService.handleFirstSale()
               ├─> Update has_first_sale=true, first_sale_at=now
               └─> If plan != Starter:
                   └─> billingService.activateMonthlyFee()
                       ├─> Create subscription in Stripe
                       └─> Update monthly_fee_active=true

3. Creator notified
   ├─> Email: "Congratulations on your first sale!"
   └─> If Pro/Scale: "Your €X/month subscription is now active"
```

### Flow 4: Upgrade/Downgrade

```
UPGRADE (Starter → Pro, Pro → Scale):
1. Creator selects higher plan
2. If has_first_sale:
   └─> Create/update Stripe subscription with proration
       └─> Immediate access, prorated charge
3. If !has_first_sale:
   └─> Just update plan_id
       └─> Monthly fee will activate on first sale

DOWNGRADE (Scale → Pro, Pro → Starter):
1. Creator selects lower plan
2. Show warning: "Change takes effect at end of billing period"
3. Update subscription to cancel at period end
4. At period end:
   └─> Webhook: customer.subscription.updated
       └─> Update to new plan
```

### Flow 5: Stripe Connect Onboarding

```
1. After activation fee paid
   └─> Prompt: "Set up payouts to receive your earnings"

2. Click "Set up payouts"
   └─> billingService.createConnectAccount()
       ├─> Create Express Connect account
       └─> Return onboarding URL

3. Redirect to Stripe Express onboarding
   └─> User provides business info, bank details

4. Complete onboarding
   └─> Redirect back to /settings/billing

5. Webhook: account.updated
   └─> Update stripe_account_status
       └─> If payouts_enabled: Creator can receive earnings
```

---

## Webhook Events

### Webhook Handler Configuration

```typescript
// Webhook endpoint: POST /api/webhooks/stripe
// Verify signature using STRIPE_WEBHOOK_SECRET

const HANDLED_EVENTS = [
  // Checkout & Payments
  'checkout.session.completed',
  'checkout.session.expired',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',

  // Subscriptions
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',

  // Invoices
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.upcoming',

  // Connect
  'account.updated',
  'account.application.deauthorized',
  'payout.paid',
  'payout.failed',

  // Disputes
  'charge.dispute.created',
  'charge.dispute.closed'
];
```

### Event Processing Logic

| Event | Handler Action |
|-------|----------------|
| `checkout.session.completed` | Record activation fee, activate billing, or process sale |
| `invoice.paid` | Record subscription payment, update period dates |
| `invoice.payment_failed` | Mark past_due, send retry notification |
| `customer.subscription.created` | Initialize subscription tracking |
| `customer.subscription.updated` | Handle plan changes, cancellation scheduling |
| `customer.subscription.deleted` | Finalize cancellation, downgrade to Starter |
| `payment_intent.succeeded` | Record sale, trigger first sale logic |
| `account.updated` | Update Connect account status |
| `payout.paid` | Record payout in transactions |

### Idempotency Pattern

```typescript
async function processWebhook(event: Stripe.Event): Promise<void> {
  // 1. Check if already processed
  const existing = await supabase
    .from('webhook_events')
    .select('id, processed')
    .eq('stripe_event_id', event.id)
    .single();

  if (existing?.processed) {
    return; // Already handled
  }

  // 2. Store event
  await supabase.from('webhook_events').upsert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event,
    processed: false
  });

  // 3. Process
  try {
    await webhookHandlers[event.type]?.(event);

    // 4. Mark processed
    await supabase
      .from('webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('stripe_event_id', event.id);
  } catch (error) {
    await supabase
      .from('webhook_events')
      .update({ error: error.message })
      .eq('stripe_event_id', event.id);
    throw error;
  }
}
```

---

## Feature Gating

### Plan Limits Configuration

```typescript
const PLAN_LIMITS: Record<PlanTier, PlanFeatures> = {
  starter: {
    max_students: 50,
    max_courses: 2,
    max_communities: 1,
    ai_enabled: true,
    custom_branding: false,
    priority_support: false,
    white_label: false,
    advanced_analytics: false,
    api_access: false
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
    api_access: false
  },
  scale: {
    max_students: -1,  // Unlimited
    max_courses: -1,
    max_communities: -1,
    ai_enabled: true,
    custom_branding: true,
    priority_support: true,
    white_label: true,
    advanced_analytics: true,
    api_access: true
  }
};
```

### Enforcement Points

```typescript
// 1. Before creating a course
async function createCourse(creatorId: string, courseData: CourseInput) {
  const limits = await getPlanLimits(creatorId);

  if (!limits.canAddCourse) {
    throw new UpgradRequiredError('course_limit', limits.usage.courses);
  }

  // Create course...
}

// 2. Before adding a student
async function enrollStudent(creatorId: string, studentId: string, courseId: string) {
  const limits = await getPlanLimits(creatorId);

  if (!limits.canAddStudent) {
    throw new UpgradRequiredError('student_limit', limits.usage.students);
  }

  // Enroll student...
}

// 3. Before showing features in UI
function FeatureGatedButton({ feature, children }: Props) {
  const { hasAccess, showUpgradePrompt } = usePlanLimits();

  if (!hasAccess(feature)) {
    return (
      <Button onClick={() => showUpgradePrompt(feature)} disabled>
        {children} <LockIcon />
      </Button>
    );
  }

  return <Button>{children}</Button>;
}
```

### Upgrade Prompts

```typescript
// Show contextual upgrade prompts when limits reached
const UPGRADE_MESSAGES: Record<string, { title: string; description: string }> = {
  course_limit: {
    title: 'Course Limit Reached',
    description: 'Upgrade to Pro to create up to 10 courses, or Scale for unlimited.'
  },
  student_limit: {
    title: 'Student Limit Reached',
    description: 'Your community is growing! Upgrade to Pro for 500 students or Scale for unlimited.'
  },
  custom_branding: {
    title: 'Custom Branding',
    description: 'Remove Creator Club branding and add your own logo. Available on Pro and Scale plans.'
  },
  // ...
};
```

---

## Security Considerations

### 1. PCI Compliance

- **Never** store credit card data in our database
- Use Stripe Checkout (hosted) for all card collection
- Use Stripe Elements if building custom payment forms
- All payment processing happens on Stripe's PCI-compliant infrastructure

### 2. Webhook Security

```typescript
// Verify webhook signature
async function verifyWebhook(req: Request): Promise<Stripe.Event> {
  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    return stripe.webhooks.constructEvent(
      req.body,
      signature,
      webhookSecret
    );
  } catch (err) {
    throw new Error('Invalid webhook signature');
  }
}
```

### 3. Database Security

```sql
-- RLS Policies for billing tables

-- creator_billing: Only creator can see their own billing
CREATE POLICY "Creators can view own billing"
  ON public.creator_billing FOR SELECT
  USING (creator_id = auth.uid());

CREATE POLICY "Creators can update own billing"
  ON public.creator_billing FOR UPDATE
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- billing_transactions: Creator can view their transactions
CREATE POLICY "Creators can view own transactions"
  ON public.billing_transactions FOR SELECT
  USING (creator_id = auth.uid());

-- webhook_events: Service role only
CREATE POLICY "Service role only"
  ON public.webhook_events FOR ALL
  USING (auth.role() = 'service_role');

-- billing_plans: Readable by all authenticated users
CREATE POLICY "Plans readable by authenticated"
  ON public.billing_plans FOR SELECT
  USING (auth.role() = 'authenticated');
```

### 4. API Key Security

```typescript
// Environment variables (never commit to repo)
STRIPE_SECRET_KEY=sk_live_...     // Server-side only
STRIPE_PUBLISHABLE_KEY=pk_live_... // Client-side safe
STRIPE_WEBHOOK_SECRET=whsec_...   // Server-side only
```

### 5. Financial Data Protection

- Store amounts in cents (integers, not floats)
- Always use currency codes (EUR)
- Log all financial operations to `billing_transactions`
- Immutable transaction records (no updates, only inserts)
- Idempotent webhook processing

---

## Environment Variables

```bash
# Stripe Keys
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Product IDs (created in Stripe Dashboard)
STRIPE_ACTIVATION_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_SCALE_PRICE_ID=price_...

# Application URLs
APP_URL=https://app.creatorclub.com
```

---

## Migration Plan

### Phase 1: Database & Types
1. Create migration `011_billing_system.sql`
2. Update TypeScript types in `types.ts` and `database.types.ts`
3. Seed `billing_plans` table with Starter/Pro/Scale

### Phase 2: Stripe Integration
1. Install `@stripe/stripe-js` and `stripe` packages
2. Create Stripe Products and Prices in Dashboard
3. Implement `billingService.ts`
4. Create webhook handler endpoint

### Phase 3: UI Components
1. Create billing feature folder structure
2. Implement PricingPage and PlanCard components
3. Implement BillingSettingsPage
4. Add ActivationPage for onboarding
5. Integrate usePlanLimits hook throughout app

### Phase 4: User Flows
1. Update registration flow with activation fee
2. Add Stripe Connect onboarding
3. Implement plan upgrade/downgrade flows
4. Add first sale trigger logic

---

## Testing Checklist

- [ ] Activation fee payment completes successfully
- [ ] Starter plan has no monthly charges
- [ ] Pro/Scale plans charge only after first sale
- [ ] Plan upgrades prorate correctly
- [ ] Plan downgrades take effect at period end
- [ ] First sale triggers monthly fee activation
- [ ] Platform fees calculated correctly per plan
- [ ] Webhooks process idempotently
- [ ] Failed payments trigger retry logic
- [ ] Cancellation flow works correctly
- [ ] Stripe Connect onboarding completes
- [ ] Feature gating enforces limits
- [ ] Transaction history displays correctly

---

## Open Questions

1. **Grace period for failed payments**: How long before downgrading to Starter?
   - Recommendation: 7 days with 3 retry attempts

2. **Annual plans**: Add in Phase 1 or later?
   - Recommendation: Later phase, monthly is simpler for MVP

3. **Refund policy**: Who handles refunds for creator sales?
   - Recommendation: Creators handle via Stripe Dashboard

4. **Currency support**: EUR only or multi-currency?
   - Recommendation: EUR only for MVP, expand later

---

**End of Architecture Document**
