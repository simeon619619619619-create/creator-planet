# Community Monetization Design

**Date:** 2026-01-03
**Status:** 📋 PLANNING → APPROVED
**Author:** Claude (Architect)
**Phase:** Phase 2 - Creator Product Sales
**Approved:** 2026-01-03 (Brainstorming session complete)

---

## Overview

This document defines the complete architecture for paid community access. Creators can set pricing (free, one-time, or monthly) for their communities. Students purchase access via Stripe Checkout, with payments automatically split between the platform and creator via Stripe Connect.

### Key Design Decisions (from Brainstorming)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Onboarding approach | Sequential | Clear path: Signup → Plan → Connect → Monetize |
| Trial creator billing | Optional early start | "Start Subscription Now" button for eager creators |
| Connect setup timing | Just-in-time | Prompt when creator tries to set a paid price |
| Pricing options (MVP) | Free, One-time, Monthly | Simple; architecture ready for tiers, annual, trials |
| Student checkout | Stripe Checkout (redirect) | Consistent with creator billing, battle-tested |
| Fee model | Transparent split | Student pays listed price, creator sees fee breakdown |

### Current State

| Component | Status |
|-----------|--------|
| `communities` table | ❌ No pricing fields |
| `memberships` table | ❌ No payment tracking |
| JoinButton component | ❌ Instant free join only |
| Stripe Connect | ⏳ Platform profile pending verification |
| Platform fee calculation | ✅ Based on creator plan tier |
| Billing UI for trial creators | ❌ Shows broken "Manage Payment Method" |

### Target State

| Component | Status |
|-----------|--------|
| `communities` table | ✅ Pricing type, amount, Stripe product/price IDs |
| `memberships` table | ✅ Payment status, subscription tracking |
| JoinButton/PaymentButton | ✅ Conditional: free join or Stripe Checkout |
| Edge Function | ✅ `community-checkout` for payment processing |
| Creator Settings | ✅ Pricing configuration UI |
| Billing UI for trial creators | ✅ Hide payment mgmt, show "Start Subscription Now" |

---

## Creator Journey & States

### The Complete Flow

```
Signup → Free Trial (Starter) → Build Content → Ready to Monetize? → Connect Setup → Set Prices → First Sale → Subscription Activates
```

### Creator Billing States

| State | Has Connect | Has Subscription | Can Sell | Billing UI |
|-------|-------------|------------------|----------|------------|
| Trial (new) | ❌ | ❌ | ❌ | Plan info, upgrade buttons, "Start Subscription Now" |
| Trial + Connect | ✅ | ❌ | ✅ | Same + Connect status badge |
| Early Subscriber | ✅ | ✅ | ✅ | Full billing management |
| Active (post-first-sale) | ✅ | ✅ | ✅ | Full billing management |

### What Triggers What

- **Creator clicks "Set Paid Price"** → If no Connect → "Set up payouts first" modal → Stripe Connect onboarding
- **Creator clicks "Start Subscription Now"** → Creates Stripe customer → Starts billing immediately (optional, for eager creators)
- **First student payment received** → If trial → Auto-trigger subscription start

### Billing Settings Page Behavior

**For Trial Creators:**
- Show current plan info (Starter trial)
- Show upgrade buttons (Pro/Scale)
- Show "Start Subscription Now" button (optional early payment)
- **HIDE** "Manage Payment Method" (no stripe_customer_id exists)
- Show Connect setup status/CTA

**For Active Subscribers:**
- Show full billing management
- Show "Manage Payment Method" button
- Show invoice history
- Show plan change/cancel options

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Pricing Types | free, one_time, monthly | Covers all common monetization models |
| Payment Flow | Stripe Checkout (hosted) | PCI compliant, consistent with existing billing |
| Monthly Billing | Stripe Subscriptions | Automatic renewal, dunning, portal management |
| Fee Split | Application fees on Connect | Same as course sales, already implemented |
| Access Control | RLS + membership.payment_status | Database-level enforcement |
| Subscription Portal | Stripe Customer Portal | Students manage their own subscriptions |

---

## Database Schema

### Migration: `013_community_monetization.sql`

```sql
-- ============================================================================
-- COMMUNITY MONETIZATION SCHEMA
-- Adds pricing capabilities to communities and payment tracking to memberships
-- ============================================================================

-- 1. Add pricing type enum
CREATE TYPE community_pricing_type AS ENUM ('free', 'one_time', 'monthly');

-- 2. Add pricing columns to communities
ALTER TABLE public.communities
ADD COLUMN pricing_type community_pricing_type DEFAULT 'free' NOT NULL,
ADD COLUMN price_cents INTEGER DEFAULT 0,
ADD COLUMN currency TEXT DEFAULT 'EUR',
ADD COLUMN stripe_product_id TEXT,
ADD COLUMN stripe_price_id TEXT;

-- Add constraints
ALTER TABLE public.communities
ADD CONSTRAINT communities_price_positive CHECK (price_cents >= 0),
ADD CONSTRAINT communities_price_required CHECK (
  (pricing_type = 'free' AND price_cents = 0) OR
  (pricing_type != 'free' AND price_cents > 0)
);

-- Indexes for pricing queries
CREATE INDEX communities_pricing_type_idx ON public.communities(pricing_type);
CREATE INDEX communities_stripe_product_id_idx ON public.communities(stripe_product_id);

COMMENT ON COLUMN public.communities.pricing_type IS 'free=no payment, one_time=single purchase, monthly=subscription';
COMMENT ON COLUMN public.communities.price_cents IS 'Price in cents (EUR). 0 for free communities.';

-- 3. Add payment tracking to memberships
ALTER TABLE public.memberships
ADD COLUMN payment_status TEXT DEFAULT 'none',
ADD COLUMN stripe_customer_id TEXT,
ADD COLUMN stripe_subscription_id TEXT,
ADD COLUMN stripe_payment_intent_id TEXT,
ADD COLUMN paid_at TIMESTAMPTZ,
ADD COLUMN expires_at TIMESTAMPTZ,
ADD COLUMN canceled_at TIMESTAMPTZ;

-- Add constraint for payment status
ALTER TABLE public.memberships
ADD CONSTRAINT memberships_payment_status_valid CHECK (
  payment_status IN ('none', 'pending', 'paid', 'failed', 'canceled', 'expired')
);

-- Indexes for payment queries
CREATE INDEX memberships_payment_status_idx ON public.memberships(payment_status);
CREATE INDEX memberships_stripe_subscription_id_idx ON public.memberships(stripe_subscription_id);
CREATE INDEX memberships_expires_at_idx ON public.memberships(expires_at);

COMMENT ON COLUMN public.memberships.payment_status IS 'none=free, pending=checkout started, paid=access granted, failed/canceled/expired=no access';
COMMENT ON COLUMN public.memberships.expires_at IS 'For monthly: subscription renewal date. For one_time: null (lifetime).';

-- 4. Update RLS policies for paid communities

-- Members can only access if payment_status = 'paid' or community is free
DROP POLICY IF EXISTS "Members can view community content" ON public.community_channels;

CREATE POLICY "Members can view paid community channels"
  ON public.community_channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      JOIN public.communities c ON c.id = m.community_id
      WHERE m.community_id = community_channels.community_id
        AND m.user_id = get_my_profile_id()
        AND (c.pricing_type = 'free' OR m.payment_status = 'paid')
    )
  );

-- Similar policy for posts
DROP POLICY IF EXISTS "Members can view posts" ON public.posts;

CREATE POLICY "Members can view posts in accessible communities"
  ON public.posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      JOIN public.communities c ON c.id = m.community_id
      JOIN public.community_channels ch ON ch.id = posts.channel_id
      WHERE ch.community_id = m.community_id
        AND m.user_id = get_my_profile_id()
        AND (c.pricing_type = 'free' OR m.payment_status = 'paid')
    )
  );

-- 5. Create community_purchases table for transaction tracking
CREATE TABLE public.community_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES public.communities(id) ON DELETE SET NULL NOT NULL,
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  membership_id UUID REFERENCES public.memberships(id) ON DELETE SET NULL,

  -- Purchase details
  purchase_type community_pricing_type NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'EUR' NOT NULL,

  -- Fee breakdown
  platform_fee_cents INTEGER NOT NULL,
  stripe_fee_cents INTEGER NOT NULL,
  creator_payout_cents INTEGER NOT NULL,

  -- Stripe references
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_subscription_id TEXT,
  stripe_transfer_id TEXT,

  -- Status
  status TEXT DEFAULT 'pending' NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,

  CONSTRAINT community_purchases_status_valid CHECK (
    status IN ('pending', 'completed', 'failed', 'refunded')
  )
);

-- Indexes
CREATE INDEX community_purchases_community_id_idx ON public.community_purchases(community_id);
CREATE INDEX community_purchases_buyer_id_idx ON public.community_purchases(buyer_id);
CREATE INDEX community_purchases_creator_id_idx ON public.community_purchases(creator_id);
CREATE INDEX community_purchases_status_idx ON public.community_purchases(status);
CREATE INDEX community_purchases_created_at_idx ON public.community_purchases(created_at DESC);

-- RLS for community_purchases
ALTER TABLE public.community_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view their community purchases"
  ON public.community_purchases FOR SELECT
  USING (creator_id = get_my_profile_id());

CREATE POLICY "Buyers can view their own purchases"
  ON public.community_purchases FOR SELECT
  USING (buyer_id = get_my_profile_id());

CREATE POLICY "Service role can manage purchases"
  ON public.community_purchases FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.community_purchases IS 'Tracks all community access purchases with fee breakdown';
```

---

## TypeScript Types

### File: `src/features/community/communityTypes.ts`

```typescript
// ============================================================================
// COMMUNITY MONETIZATION TYPES
// ============================================================================

export type CommunityPricingType = 'free' | 'one_time' | 'monthly';

export type MembershipPaymentStatus =
  | 'none'      // Free community, no payment needed
  | 'pending'   // Checkout started but not completed
  | 'paid'      // Payment successful, access granted
  | 'failed'    // Payment failed
  | 'canceled'  // Subscription canceled
  | 'expired';  // Subscription expired (past due)

export interface CommunityPricing {
  pricing_type: CommunityPricingType;
  price_cents: number;
  currency: string;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
}

export interface CommunityWithPricing extends DbCommunity {
  pricing_type: CommunityPricingType;
  price_cents: number;
  currency: string;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
}

export interface MembershipWithPayment extends DbMembership {
  payment_status: MembershipPaymentStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  expires_at: string | null;
  canceled_at: string | null;
}

export interface CommunityPurchase {
  id: string;
  community_id: string;
  buyer_id: string;
  creator_id: string;
  membership_id: string | null;
  purchase_type: CommunityPricingType;
  amount_cents: number;
  currency: string;
  platform_fee_cents: number;
  stripe_fee_cents: number;
  creator_payout_cents: number;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_subscription_id: string | null;
  stripe_transfer_id: string | null;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  created_at: string;
  completed_at: string | null;
  refunded_at: string | null;
}

// UI Display Types
export interface CommunityPricingDisplay {
  type: CommunityPricingType;
  price: string;           // Formatted: "€9.90" or "Free"
  interval: string | null; // "/ month" or null
  buttonText: string;      // "Join Free", "Buy Access", "Subscribe"
}

export interface CommunityCheckoutRequest {
  communityId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CommunityCheckoutResult {
  success: boolean;
  checkoutUrl?: string;
  sessionId?: string;
  error?: string;
}
```

---

## Edge Function: `community-checkout`

### File: `supabase/functions/community-checkout/index.ts`

```typescript
// ============================================================================
// COMMUNITY CHECKOUT EDGE FUNCTION
// Creates Stripe Checkout sessions for paid community access
// ============================================================================
//
// Endpoint: POST /community-checkout
// Body: { communityId: string, successUrl: string, cancelUrl: string }
// Returns: { checkoutUrl: string, sessionId: string }
//
// Security:
// - Requires valid JWT authentication
// - Verifies community exists and is paid
// - Uses creator's Stripe Connect account for payouts
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { getUserFromToken, createServiceClient } from '../_shared/supabase.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import {
  jsonResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '../_shared/response.ts';

interface CheckoutRequest {
  communityId: string;
  successUrl: string;
  cancelUrl: string;
}

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // 1. Verify authentication
    const authHeader = req.headers.get('Authorization');
    const user = await getUserFromToken(authHeader);
    if (!user) {
      return unauthorizedResponse('Invalid or missing authentication token');
    }

    // 2. Parse request
    const body: CheckoutRequest = await req.json();
    const { communityId, successUrl, cancelUrl } = body;

    if (!communityId || !successUrl || !cancelUrl) {
      return errorResponse('Missing required fields');
    }

    // 3. Initialize clients
    const stripe = getStripeClient();
    const supabase = createServiceClient();

    // 4. Get buyer's profile
    const { data: buyerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('user_id', user.userId)
      .single();

    if (profileError || !buyerProfile) {
      return errorResponse('User profile not found');
    }

    // 5. Get community with creator info
    const { data: community, error: communityError } = await supabase
      .from('communities')
      .select(`
        *,
        creator:profiles!creator_id(id, email, full_name)
      `)
      .eq('id', communityId)
      .single();

    if (communityError || !community) {
      return errorResponse('Community not found', 404);
    }

    // 6. Validate community is paid
    if (community.pricing_type === 'free') {
      return errorResponse('This community is free. Use the regular join flow.');
    }

    if (!community.price_cents || community.price_cents <= 0) {
      return errorResponse('Community pricing not configured');
    }

    // 7. Check if already a paid member
    const { data: existingMembership } = await supabase
      .from('memberships')
      .select('id, payment_status')
      .eq('user_id', buyerProfile.id)
      .eq('community_id', communityId)
      .single();

    if (existingMembership?.payment_status === 'paid') {
      return errorResponse('You already have access to this community');
    }

    // 8. Get creator's billing info (for Connect account and plan tier)
    const { data: creatorBilling, error: billingError } = await supabase
      .from('creator_billing')
      .select(`
        stripe_account_id,
        stripe_account_status,
        plan:billing_plans(tier, platform_fee_percent)
      `)
      .eq('creator_id', community.creator_id)
      .single();

    if (billingError || !creatorBilling?.stripe_account_id) {
      return errorResponse('Creator has not set up payouts. Contact the community owner.');
    }

    if (creatorBilling.stripe_account_status !== 'active') {
      return errorResponse('Creator payout account is not active');
    }

    // 9. Calculate platform fee based on creator's plan
    const platformFeePercent = creatorBilling.plan?.platform_fee_percent || 6.9;
    const platformFeeCents = Math.round(community.price_cents * (platformFeePercent / 100));

    // 10. Get or create Stripe customer for buyer
    let customerId: string;

    // Check if we have a customer ID from a previous membership attempt
    if (existingMembership?.stripe_customer_id) {
      customerId = existingMembership.stripe_customer_id;
    } else {
      // Search for existing customer by email
      const existingCustomers = await stripe.customers.list({
        email: buyerProfile.email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id;
      } else {
        // Create new customer
        const customer = await stripe.customers.create({
          email: buyerProfile.email,
          name: buyerProfile.full_name || undefined,
          metadata: {
            profile_id: buyerProfile.id,
            platform: 'creator_club',
          },
        });
        customerId = customer.id;
      }
    }

    // 11. Create or get Stripe Price
    let priceId = community.stripe_price_id;

    if (!priceId) {
      // Create product and price dynamically
      const product = await stripe.products.create({
        name: `${community.name} - Community Access`,
        metadata: {
          community_id: communityId,
          creator_id: community.creator_id,
        },
      });

      const priceParams: any = {
        product: product.id,
        unit_amount: community.price_cents,
        currency: community.currency?.toLowerCase() || 'eur',
        metadata: {
          community_id: communityId,
        },
      };

      if (community.pricing_type === 'monthly') {
        priceParams.recurring = { interval: 'month' };
      }

      const price = await stripe.prices.create(priceParams);
      priceId = price.id;

      // Update community with Stripe IDs
      await supabase
        .from('communities')
        .update({
          stripe_product_id: product.id,
          stripe_price_id: price.id,
        })
        .eq('id', communityId);
    }

    // 12. Create membership record (pending status)
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .upsert({
        user_id: buyerProfile.id,
        community_id: communityId,
        role: 'member',
        payment_status: 'pending',
        stripe_customer_id: customerId,
        joined_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,community_id',
      })
      .select()
      .single();

    if (membershipError) {
      console.error('Membership creation error:', membershipError);
      return serverErrorResponse('Failed to create membership');
    }

    // 13. Create Stripe Checkout session
    const checkoutMode = community.pricing_type === 'monthly' ? 'subscription' : 'payment';

    const sessionParams: any = {
      mode: checkoutMode,
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl.includes('{CHECKOUT_SESSION_ID}')
        ? successUrl
        : `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        type: 'community_access',
        community_id: communityId,
        buyer_id: buyerProfile.id,
        creator_id: community.creator_id,
        membership_id: membership.id,
      },
    };

    // Add application fee for Connect
    if (checkoutMode === 'payment') {
      sessionParams.payment_intent_data = {
        application_fee_amount: platformFeeCents,
        transfer_data: {
          destination: creatorBilling.stripe_account_id,
        },
        metadata: {
          community_id: communityId,
          buyer_id: buyerProfile.id,
          creator_id: community.creator_id,
        },
      };
    } else {
      // For subscriptions, use subscription_data
      sessionParams.subscription_data = {
        application_fee_percent: platformFeePercent,
        transfer_data: {
          destination: creatorBilling.stripe_account_id,
        },
        metadata: {
          community_id: communityId,
          buyer_id: buyerProfile.id,
          creator_id: community.creator_id,
          membership_id: membership.id,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // 14. Create purchase record
    await supabase
      .from('community_purchases')
      .insert({
        community_id: communityId,
        buyer_id: buyerProfile.id,
        creator_id: community.creator_id,
        membership_id: membership.id,
        purchase_type: community.pricing_type,
        amount_cents: community.price_cents,
        currency: community.currency || 'EUR',
        platform_fee_cents: platformFeeCents,
        stripe_fee_cents: Math.round(community.price_cents * 0.029 + 25), // Estimated Stripe fee
        creator_payout_cents: community.price_cents - platformFeeCents,
        stripe_checkout_session_id: session.id,
        status: 'pending',
      });

    return jsonResponse({
      checkoutUrl: session.url,
      sessionId: session.id,
    });

  } catch (error) {
    console.error('Community checkout error:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : 'Failed to create checkout session'
    );
  }
});
```

---

## Webhook Handler Updates

### Add to `supabase/functions/stripe-webhook/index.ts`

```typescript
// Add these handlers to the existing webhook function

async function handleCommunityCheckoutComplete(session: Stripe.Checkout.Session) {
  const metadata = session.metadata;
  if (metadata?.type !== 'community_access') return;

  const supabase = createServiceClient();
  const membershipId = metadata.membership_id;
  const communityId = metadata.community_id;
  const buyerId = metadata.buyer_id;
  const creatorId = metadata.creator_id;

  // 1. Update membership to paid
  const updateData: any = {
    payment_status: 'paid',
    paid_at: new Date().toISOString(),
  };

  if (session.subscription) {
    updateData.stripe_subscription_id = session.subscription;
    // Get subscription to find renewal date
    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
    updateData.expires_at = new Date(subscription.current_period_end * 1000).toISOString();
  }

  if (session.payment_intent) {
    updateData.stripe_payment_intent_id = session.payment_intent;
  }

  await supabase
    .from('memberships')
    .update(updateData)
    .eq('id', membershipId);

  // 2. Update purchase record
  await supabase
    .from('community_purchases')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      stripe_payment_intent_id: session.payment_intent,
      stripe_subscription_id: session.subscription,
    })
    .eq('stripe_checkout_session_id', session.id);

  // 3. Record in creator_sales for platform fee tracking
  const { data: community } = await supabase
    .from('communities')
    .select('name, price_cents')
    .eq('id', communityId)
    .single();

  if (community) {
    const { data: creatorBilling } = await supabase
      .from('creator_billing')
      .select('plan:billing_plans(platform_fee_percent)')
      .eq('creator_id', creatorId)
      .single();

    const feePercent = creatorBilling?.plan?.platform_fee_percent || 6.9;
    const platformFee = Math.round(community.price_cents * (feePercent / 100));
    const stripeFee = Math.round(community.price_cents * 0.029 + 25);

    await supabase
      .from('creator_sales')
      .insert({
        creator_id: creatorId,
        buyer_id: buyerId,
        product_type: 'membership',
        product_id: communityId,
        product_name: community.name,
        sale_amount_cents: community.price_cents,
        platform_fee_cents: platformFee,
        stripe_fee_cents: stripeFee,
        net_amount_cents: community.price_cents - platformFee,
        stripe_payment_intent_id: session.payment_intent,
        status: 'completed',
        completed_at: new Date().toISOString(),
      });

    // 4. Handle first sale trigger for creator
    await handleFirstSaleTrigger(creatorId, supabase);
  }
}

async function handleCommunitySubscriptionUpdated(subscription: Stripe.Subscription) {
  const metadata = subscription.metadata;
  if (!metadata?.community_id) return;

  const supabase = createServiceClient();

  // Update membership expiry
  await supabase
    .from('memberships')
    .update({
      expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
      payment_status: subscription.status === 'active' ? 'paid' : 'expired',
    })
    .eq('stripe_subscription_id', subscription.id);
}

async function handleCommunitySubscriptionDeleted(subscription: Stripe.Subscription) {
  const metadata = subscription.metadata;
  if (!metadata?.membership_id) return;

  const supabase = createServiceClient();

  await supabase
    .from('memberships')
    .update({
      payment_status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);
}
```

---

## UI Components

### 1. Creator Pricing Settings

**File:** `src/features/community/components/CommunityPricingSettings.tsx`

```typescript
import React, { useState } from 'react';
import { DollarSign, Users, Calendar, Lock } from 'lucide-react';
import type { CommunityPricingType, CommunityWithPricing } from '../communityTypes';

interface Props {
  community: CommunityWithPricing;
  onSave: (pricing: { type: CommunityPricingType; priceCents: number }) => Promise<void>;
  isLoading?: boolean;
}

export const CommunityPricingSettings: React.FC<Props> = ({
  community,
  onSave,
  isLoading = false,
}) => {
  const [pricingType, setPricingType] = useState<CommunityPricingType>(
    community.pricing_type || 'free'
  );
  const [priceEuros, setPriceEuros] = useState(
    community.price_cents ? (community.price_cents / 100).toString() : ''
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const priceCents = pricingType === 'free' ? 0 : Math.round(parseFloat(priceEuros) * 100);
      await onSave({ type: pricingType, priceCents });
    } finally {
      setIsSaving(false);
    }
  };

  const pricingOptions = [
    {
      type: 'free' as const,
      title: 'Free',
      description: 'Anyone can join for free',
      icon: Users,
    },
    {
      type: 'one_time' as const,
      title: 'One-time Payment',
      description: 'Pay once, access forever',
      icon: Lock,
    },
    {
      type: 'monthly' as const,
      title: 'Monthly Subscription',
      description: 'Recurring monthly access',
      icon: Calendar,
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">
        Community Pricing
      </h3>

      {/* Pricing Type Selection */}
      <div className="space-y-3 mb-6">
        {pricingOptions.map((option) => (
          <label
            key={option.type}
            className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
              pricingType === option.type
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="pricingType"
              value={option.type}
              checked={pricingType === option.type}
              onChange={() => setPricingType(option.type)}
              className="sr-only"
            />
            <option.icon className={`w-5 h-5 mr-3 ${
              pricingType === option.type ? 'text-indigo-600' : 'text-slate-400'
            }`} />
            <div className="flex-1">
              <p className="font-medium text-slate-900">{option.title}</p>
              <p className="text-sm text-slate-500">{option.description}</p>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 ${
              pricingType === option.type
                ? 'border-indigo-600 bg-indigo-600'
                : 'border-slate-300'
            }`}>
              {pricingType === option.type && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                </div>
              )}
            </div>
          </label>
        ))}
      </div>

      {/* Price Input (for paid options) */}
      {pricingType !== 'free' && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Price {pricingType === 'monthly' ? '(per month)' : ''}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">€</span>
            <input
              type="number"
              min="0.50"
              step="0.01"
              value={priceEuros}
              onChange={(e) => setPriceEuros(e.target.value)}
              placeholder="9.90"
              className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {pricingType === 'monthly'
              ? 'Members will be billed monthly. They can cancel anytime.'
              : 'Members pay once and get lifetime access.'}
          </p>
        </div>
      )}

      {/* Platform Fee Info */}
      {pricingType !== 'free' && priceEuros && (
        <div className="bg-slate-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-slate-600">
            <span className="font-medium">Your earnings:</span>{' '}
            €{(parseFloat(priceEuros) * 0.931).toFixed(2)} per sale
            <span className="text-slate-400"> (after 6.9% platform fee)</span>
          </p>
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={isSaving || isLoading || (pricingType !== 'free' && !priceEuros)}
        className="w-full py-2 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSaving ? 'Saving...' : 'Save Pricing'}
      </button>
    </div>
  );
};
```

### 2. Updated JoinButton with Payment Support

**File:** `src/public-pages/communities/JoinButton.tsx` (updated)

```typescript
// Add to existing JoinButton.tsx - key changes:

import { createCommunityCheckout } from '../../features/community/communityPaymentService';

// In the component, add pricing awareness:
const [communityPricing, setCommunityPricing] = useState<{
  type: CommunityPricingType;
  price_cents: number;
} | null>(null);

// Fetch pricing info when component mounts
useEffect(() => {
  const loadPricing = async () => {
    const { data } = await supabase
      .from('communities')
      .select('pricing_type, price_cents')
      .eq('id', communityId)
      .single();
    if (data) setCommunityPricing(data);
  };
  loadPricing();
}, [communityId]);

// Update handleClick to handle payments:
const handleClick = async () => {
  // ... existing auth check ...

  // If paid community, redirect to checkout
  if (communityPricing?.type !== 'free' && communityPricing?.price_cents > 0) {
    setIsJoining(true);
    try {
      const result = await createCommunityCheckout({
        communityId,
        successUrl: `${window.location.origin}/community/${communityId}?success=true`,
        cancelUrl: `${window.location.origin}/community/${communityId}?canceled=true`,
      });

      if (result.success && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        setError(result.error || 'Failed to start checkout');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsJoining(false);
    }
    return;
  }

  // ... existing free join logic ...
};

// Update button text
const getButtonText = () => {
  if (isJoining) return 'Processing...';
  if (isMember) return 'Go to Community';

  if (communityPricing?.type === 'monthly') {
    return `Subscribe - €${(communityPricing.price_cents / 100).toFixed(2)}/mo`;
  }
  if (communityPricing?.type === 'one_time') {
    return `Get Access - €${(communityPricing.price_cents / 100).toFixed(2)}`;
  }

  return user ? 'Join Community' : 'Join to Access';
};
```

### 3. Community Payment Service

**File:** `src/features/community/communityPaymentService.ts`

```typescript
import { supabase } from '../../core/supabase/client';
import type {
  CommunityCheckoutRequest,
  CommunityCheckoutResult,
  CommunityPricingType,
} from './communityTypes';

/**
 * Create a Stripe Checkout session for community access
 */
export async function createCommunityCheckout(
  request: CommunityCheckoutRequest
): Promise<CommunityCheckoutResult> {
  try {
    const { data, error } = await supabase.functions.invoke('community-checkout', {
      body: request,
    });

    if (error) {
      console.error('Community checkout error:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      checkoutUrl: data.checkoutUrl,
      sessionId: data.sessionId,
    };
  } catch (err) {
    console.error('Community checkout error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create checkout',
    };
  }
}

/**
 * Update community pricing
 */
export async function updateCommunityPricing(
  communityId: string,
  pricing: { type: CommunityPricingType; priceCents: number }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('communities')
      .update({
        pricing_type: pricing.type,
        price_cents: pricing.priceCents,
        // Clear Stripe IDs so they get regenerated with new price
        stripe_product_id: null,
        stripe_price_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', communityId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update pricing',
    };
  }
}

/**
 * Get community subscription portal URL for member
 */
export async function getCommunityPortalUrl(
  communityId: string
): Promise<{ success: boolean; portalUrl?: string; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('community-portal', {
      body: {
        communityId,
        returnUrl: window.location.href,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, portalUrl: data.portalUrl };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get portal URL',
    };
  }
}
```

---

## Implementation Checklist

### Blocker: Stripe Connect Platform Profile
- [ ] Complete Stripe Connect platform profile verification
- [ ] Verify Express accounts can be created

### Phase 1: Fix Current UI Issues (Pre-Connect)
- [ ] Hide "Manage Payment Method" for trial creators (no stripe_customer_id)
- [ ] Add "Start Subscription Now" button for eager trial creators
- [ ] Show Connect setup status clearly in billing settings
- [ ] Fix any remaining profile ID vs user ID bugs

### Phase 2: Community Monetization Database
- [ ] Create migration `013_community_monetization.sql`
- [ ] Apply migration to Supabase
- [ ] Update TypeScript types in `communityTypes.ts`
- [ ] Update `database.types.ts` with new columns

### Phase 3: Edge Functions
- [ ] Create `community-checkout` Edge Function
- [ ] Update `stripe-webhook` with community payment handlers
- [ ] Create `community-portal` Edge Function (member subscription management)
- [ ] Deploy all functions
- [ ] Test webhook with Stripe CLI

### Phase 4: Frontend - Creator Settings
- [ ] Create `CommunityPricingSettings` component
- [ ] Add pricing tab to community settings modal
- [ ] Create `communityPaymentService.ts`
- [ ] Add Just-in-time Connect setup prompt when setting paid price
- [ ] Test pricing update flow

### Phase 5: Frontend - Student Purchase
- [ ] Update `JoinButton` with payment support
- [ ] Add pricing display to `CommunityLandingPage`
- [ ] Handle success/cancel return URLs
- [ ] Add subscription management link for paid members

### Phase 6: Earnings & Payouts
- [ ] Creator earnings dashboard component
- [ ] Payout history (from Stripe Connect)
- [ ] Fee breakdown visualization

### Phase 7: Testing & Polish
- [ ] E2E test: Creator sets pricing
- [ ] E2E test: Student purchases one-time access
- [ ] E2E test: Student subscribes monthly
- [ ] E2E test: Student cancels subscription
- [ ] Verify platform fees calculated correctly
- [ ] Verify payouts reach creator Connect account

---

## Security Considerations

1. **Access Control**
   - RLS policies enforce payment_status = 'paid' for content access
   - Webhook signature verification prevents tampering
   - All payment operations server-side in Edge Functions

2. **Payment Safety**
   - Never expose Stripe secret key to client
   - Validate pricing server-side before creating checkout
   - Idempotent webhook processing with event ID tracking

3. **Creator Protection**
   - Verify Connect account is active before accepting payments
   - Clear error messages if payout setup incomplete

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| User starts checkout but doesn't complete | Membership stays `pending`, can retry |
| Subscription payment fails | Status → `expired`, content access revoked |
| Creator changes price | New purchases use new price, existing subs unchanged |
| User already member (free) → community becomes paid | Existing members keep access (grandfathered) |
| Refund requested | Manual via Stripe Dashboard, update payment_status → `refunded` |

---

## Open Questions (Resolved)

1. **Trial periods?** → Not for MVP. Can add later via Stripe trial_period_days.
2. **Coupons/discounts?** → Enable `allow_promotion_codes: true` in checkout.
3. **Lifetime access expiry?** → No expiry for one_time. expires_at = null.
4. **Multiple communities discount?** → Not for MVP. Each community priced independently.

---

**End of Design Document**
