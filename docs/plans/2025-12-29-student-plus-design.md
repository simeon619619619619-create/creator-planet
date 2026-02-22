# Student Plus Architecture Design

**Date**: 2025-12-29
**Author**: Architect Agent
**Status**: ✅ IMPLEMENTED (Deployed 2025-12-30)
**Phase**: 2 - Student Monetization

---

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Database Schema | ✅ Deployed | student_plus_subscriptions table |
| Edge Functions | ✅ Deployed | student-plus-checkout, student-plus-portal |
| Frontend | ✅ Complete | StudentPlusPage with checkout success handling |
| Stripe Integration | ✅ Live | Using shared webhook for events |

## Overview

Student Plus is a €9.9/month subscription tier for students that includes:
- Private entrepreneurship/business practical newsletter
- Community perks and exclusive content access
- Loyalty points system with milestone rewards at 3/6/9/12 months
- Reward redemption capabilities (vouchers, template packs, fee discounts, priority support)

This document defines the complete architecture for the Student Plus system, building on the existing Creator billing infrastructure patterns established in Phase 1.

---

## 1. Database Schema

### 1.1 New ENUM Types

```sql
-- Student subscription status (aligned with Stripe subscription statuses)
CREATE TYPE student_subscription_status AS ENUM (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'paused'
);

-- Reward types available in the system
CREATE TYPE reward_type AS ENUM (
  'voucher',           -- Discount on course purchases
  'template_pack',     -- Downloadable template content
  'fee_discount',      -- Temporary platform fee reduction (for creators who are also students)
  'priority_support',  -- Priority support queue access
  'exclusive_content', -- Access to exclusive community content
  'badge'              -- Profile badge/achievement
);

-- Redemption status
CREATE TYPE redemption_status AS ENUM (
  'pending',    -- Reward claimed but not yet delivered
  'active',     -- Reward currently active (for time-limited rewards)
  'used',       -- One-time reward has been used
  'expired',    -- Reward expired before use
  'revoked'     -- Reward revoked (e.g., subscription canceled)
);

-- Point transaction types
CREATE TYPE point_transaction_type AS ENUM (
  'subscription_payment',  -- Points earned from monthly payment
  'milestone_bonus',       -- Bonus points for reaching a milestone
  'referral',              -- Points from referring another student
  'engagement',            -- Points from community engagement
  'redemption',            -- Points spent on rewards (negative)
  'adjustment',            -- Manual adjustment by admin
  'expiration'             -- Points expired (negative)
);
```

### 1.2 Table: `student_subscriptions`

Primary table tracking Student Plus subscriptions.

```sql
CREATE TABLE public.student_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Stripe integration
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,

  -- Subscription status
  status student_subscription_status NOT NULL DEFAULT 'incomplete',

  -- Billing period
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,

  -- Trial support (optional)
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,

  -- Cancellation tracking
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  -- Subscription milestones
  subscribed_since TIMESTAMPTZ, -- First successful payment date
  consecutive_months INTEGER DEFAULT 0,
  total_months_subscribed INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT student_subscriptions_user_id_key UNIQUE (user_id)
);

-- Indexes
CREATE INDEX idx_student_subscriptions_user_id ON public.student_subscriptions(user_id);
CREATE INDEX idx_student_subscriptions_status ON public.student_subscriptions(status);
CREATE INDEX idx_student_subscriptions_stripe_subscription_id ON public.student_subscriptions(stripe_subscription_id);
CREATE INDEX idx_student_subscriptions_consecutive_months ON public.student_subscriptions(consecutive_months);

-- RLS
ALTER TABLE public.student_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription
CREATE POLICY "Users can view own student subscription"
  ON public.student_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Only system (via service role) can insert/update
CREATE POLICY "Service role can manage student subscriptions"
  ON public.student_subscriptions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

### 1.3 Table: `loyalty_points`

Tracks point balances and transaction history for each student.

```sql
CREATE TABLE public.loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.student_subscriptions(id) ON DELETE SET NULL,

  -- Transaction details
  transaction_type point_transaction_type NOT NULL,
  points INTEGER NOT NULL, -- Positive for earned, negative for spent/expired
  balance_after INTEGER NOT NULL, -- Running balance after this transaction

  -- Description and reference
  description TEXT,
  reference_id UUID, -- Can reference milestone, reward redemption, etc.
  reference_type TEXT, -- 'milestone', 'reward', 'payment', etc.

  -- For expiration tracking
  expires_at TIMESTAMPTZ, -- When these specific points expire (if applicable)
  expired BOOLEAN DEFAULT FALSE,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT loyalty_points_valid_points CHECK (
    (transaction_type IN ('redemption', 'expiration', 'adjustment') AND points <= 0) OR
    (transaction_type NOT IN ('redemption', 'expiration') AND points >= 0) OR
    (transaction_type = 'adjustment') -- adjustments can be positive or negative
  )
);

-- Indexes
CREATE INDEX idx_loyalty_points_user_id ON public.loyalty_points(user_id);
CREATE INDEX idx_loyalty_points_created_at ON public.loyalty_points(created_at DESC);
CREATE INDEX idx_loyalty_points_transaction_type ON public.loyalty_points(transaction_type);
CREATE INDEX idx_loyalty_points_expires_at ON public.loyalty_points(expires_at) WHERE expires_at IS NOT NULL AND NOT expired;

-- RLS
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

-- Users can view their own points
CREATE POLICY "Users can view own loyalty points"
  ON public.loyalty_points FOR SELECT
  USING (auth.uid() = user_id);

-- Only system can modify
CREATE POLICY "Service role can manage loyalty points"
  ON public.loyalty_points FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Materialized view for quick balance lookups
CREATE MATERIALIZED VIEW student_point_balances AS
SELECT
  user_id,
  SUM(points) as total_points,
  SUM(CASE WHEN transaction_type = 'redemption' THEN ABS(points) ELSE 0 END) as total_spent,
  SUM(CASE WHEN transaction_type NOT IN ('redemption', 'expiration') AND points > 0 THEN points ELSE 0 END) as total_earned,
  MAX(created_at) as last_transaction_at
FROM public.loyalty_points
GROUP BY user_id;

CREATE UNIQUE INDEX idx_student_point_balances_user ON student_point_balances(user_id);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_point_balances()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY student_point_balances;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to refresh after point changes (can be async via pg_cron for performance)
CREATE TRIGGER refresh_point_balances_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.loyalty_points
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_point_balances();
```

### 1.4 Table: `loyalty_milestones`

Defines the milestone tiers and their rewards.

```sql
CREATE TABLE public.loyalty_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Milestone definition
  name TEXT NOT NULL,
  description TEXT,
  months_required INTEGER NOT NULL UNIQUE, -- 3, 6, 9, 12

  -- Rewards for reaching this milestone
  bonus_points INTEGER NOT NULL DEFAULT 0,
  reward_ids UUID[] DEFAULT '{}', -- Array of reward IDs automatically granted

  -- Display
  badge_emoji TEXT, -- e.g., '🥉', '🥈', '🥇', '💎'
  badge_color TEXT, -- Hex color for UI

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Default milestones
INSERT INTO public.loyalty_milestones (name, months_required, bonus_points, badge_emoji, badge_color, description) VALUES
  ('Bronze Member', 3, 100, '🥉', '#CD7F32', 'Thank you for 3 months of loyalty!'),
  ('Silver Member', 6, 250, '🥈', '#C0C0C0', 'Half a year of dedication!'),
  ('Gold Member', 9, 500, '🥇', '#FFD700', 'Nine months of growth!'),
  ('Diamond Member', 12, 1000, '💎', '#B9F2FF', 'One year anniversary - you are a true champion!');

-- RLS (milestones are public read)
ALTER TABLE public.loyalty_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active milestones"
  ON public.loyalty_milestones FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Service role can manage milestones"
  ON public.loyalty_milestones FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

### 1.5 Table: `student_milestone_achievements`

Tracks which milestones each student has achieved.

```sql
CREATE TABLE public.student_milestone_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_id UUID NOT NULL REFERENCES public.loyalty_milestones(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.student_subscriptions(id) ON DELETE SET NULL,

  -- Achievement details
  achieved_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  bonus_points_awarded INTEGER DEFAULT 0,

  -- Notification status
  notified BOOLEAN DEFAULT FALSE,
  notified_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints - user can only achieve each milestone once
  CONSTRAINT student_milestone_achievements_unique UNIQUE (user_id, milestone_id)
);

-- Indexes
CREATE INDEX idx_student_milestone_achievements_user ON public.student_milestone_achievements(user_id);
CREATE INDEX idx_student_milestone_achievements_milestone ON public.student_milestone_achievements(milestone_id);

-- RLS
ALTER TABLE public.student_milestone_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements"
  ON public.student_milestone_achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage achievements"
  ON public.student_milestone_achievements FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

### 1.6 Table: `rewards`

Catalog of available rewards that can be redeemed with points.

```sql
CREATE TABLE public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reward definition
  name TEXT NOT NULL,
  description TEXT,
  reward_type reward_type NOT NULL,

  -- Cost and availability
  point_cost INTEGER NOT NULL DEFAULT 0, -- 0 = milestone reward (free)
  is_milestone_reward BOOLEAN DEFAULT FALSE, -- Granted automatically at milestones

  -- Reward value/configuration
  value_config JSONB NOT NULL DEFAULT '{}',
  -- Examples:
  -- voucher: { "discount_percent": 20, "max_discount_cents": 2000, "valid_days": 30 }
  -- template_pack: { "pack_id": "templates-startup-kit", "download_url": "..." }
  -- fee_discount: { "discount_percent": 50, "duration_days": 30 }
  -- priority_support: { "duration_days": 90 }
  -- badge: { "badge_id": "early-adopter", "permanent": true }

  -- Availability
  is_active BOOLEAN DEFAULT TRUE,
  available_from TIMESTAMPTZ,
  available_until TIMESTAMPTZ,
  max_redemptions INTEGER, -- NULL = unlimited
  current_redemptions INTEGER DEFAULT 0,

  -- Per-user limits
  max_per_user INTEGER DEFAULT 1, -- How many times each user can redeem
  cooldown_days INTEGER, -- Days before user can redeem again (if max_per_user > 1)

  -- Display
  image_url TEXT,
  display_order INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Default rewards
INSERT INTO public.rewards (name, description, reward_type, point_cost, is_milestone_reward, value_config, display_order) VALUES
  -- Point-redeemable rewards
  ('10% Course Discount', 'Get 10% off any course purchase', 'voucher', 200, FALSE,
   '{"discount_percent": 10, "valid_days": 30}', 1),
  ('20% Course Discount', 'Get 20% off any course purchase', 'voucher', 400, FALSE,
   '{"discount_percent": 20, "valid_days": 30}', 2),
  ('Startup Templates Pack', 'Essential templates for launching your business', 'template_pack', 300, FALSE,
   '{"pack_id": "startup-essentials", "files": ["business-plan.docx", "pitch-deck.pptx", "financial-model.xlsx"]}', 3),
  ('Priority Support (30 days)', 'Jump to the front of the support queue', 'priority_support', 500, FALSE,
   '{"duration_days": 30}', 4),

  -- Milestone rewards (auto-granted, 0 points)
  ('Bronze Badge', 'Display your 3-month loyalty badge', 'badge', 0, TRUE,
   '{"badge_id": "bronze-member", "permanent": true}', 10),
  ('Silver Badge', 'Display your 6-month loyalty badge', 'badge', 0, TRUE,
   '{"badge_id": "silver-member", "permanent": true}', 11),
  ('Gold Badge', 'Display your 9-month loyalty badge', 'badge', 0, TRUE,
   '{"badge_id": "gold-member", "permanent": true}', 12),
  ('Diamond Badge', 'Display your 12-month loyalty badge', 'badge', 0, TRUE,
   '{"badge_id": "diamond-member", "permanent": true}', 13);

-- Indexes
CREATE INDEX idx_rewards_type ON public.rewards(reward_type);
CREATE INDEX idx_rewards_active ON public.rewards(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_rewards_milestone ON public.rewards(is_milestone_reward) WHERE is_milestone_reward = TRUE;

-- RLS
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active rewards"
  ON public.rewards FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Service role can manage rewards"
  ON public.rewards FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

### 1.7 Table: `reward_redemptions`

Tracks all reward redemptions by students.

```sql
CREATE TABLE public.reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.rewards(id) ON DELETE RESTRICT,
  subscription_id UUID REFERENCES public.student_subscriptions(id) ON DELETE SET NULL,
  milestone_achievement_id UUID REFERENCES public.student_milestone_achievements(id) ON DELETE SET NULL,

  -- Redemption details
  points_spent INTEGER NOT NULL DEFAULT 0,
  status redemption_status NOT NULL DEFAULT 'pending',

  -- Reward specifics (snapshot at time of redemption)
  reward_type reward_type NOT NULL,
  reward_value JSONB NOT NULL, -- Copy of value_config at redemption time

  -- For time-limited rewards
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,

  -- Usage tracking
  used_at TIMESTAMPTZ,
  used_for_reference TEXT, -- e.g., order ID, course ID for vouchers

  -- Voucher code (for voucher type rewards)
  voucher_code TEXT UNIQUE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_reward_redemptions_user ON public.reward_redemptions(user_id);
CREATE INDEX idx_reward_redemptions_reward ON public.reward_redemptions(reward_id);
CREATE INDEX idx_reward_redemptions_status ON public.reward_redemptions(status);
CREATE INDEX idx_reward_redemptions_voucher ON public.reward_redemptions(voucher_code) WHERE voucher_code IS NOT NULL;
CREATE INDEX idx_reward_redemptions_valid ON public.reward_redemptions(valid_until) WHERE status = 'active';

-- RLS
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own redemptions"
  ON public.reward_redemptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage redemptions"
  ON public.reward_redemptions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

---

## 2. Helper Functions

### 2.1 Get Student Point Balance

```sql
CREATE OR REPLACE FUNCTION get_student_point_balance(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT COALESCE(SUM(points), 0)
  INTO v_balance
  FROM loyalty_points
  WHERE user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > NOW())
    AND NOT expired;

  RETURN v_balance;
END;
$$;
```

### 2.2 Award Points to Student

```sql
CREATE OR REPLACE FUNCTION award_loyalty_points(
  p_user_id UUID,
  p_points INTEGER,
  p_transaction_type point_transaction_type,
  p_description TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_expires_in_days INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id UUID;
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_point_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Get subscription if exists
  SELECT id INTO v_subscription_id
  FROM student_subscriptions
  WHERE user_id = p_user_id AND status = 'active';

  -- Get current balance
  v_current_balance := get_student_point_balance(p_user_id);
  v_new_balance := v_current_balance + p_points;

  -- Validate balance doesn't go negative
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient points balance. Current: %, Requested: %', v_current_balance, ABS(p_points);
  END IF;

  -- Calculate expiration if specified
  IF p_expires_in_days IS NOT NULL THEN
    v_expires_at := NOW() + (p_expires_in_days || ' days')::INTERVAL;
  END IF;

  -- Insert point transaction
  INSERT INTO loyalty_points (
    user_id, subscription_id, transaction_type, points, balance_after,
    description, reference_id, reference_type, expires_at
  ) VALUES (
    p_user_id, v_subscription_id, p_transaction_type, p_points, v_new_balance,
    p_description, p_reference_id, p_reference_type, v_expires_at
  )
  RETURNING id INTO v_point_id;

  RETURN v_point_id;
END;
$$;
```

### 2.3 Check and Award Milestones

```sql
CREATE OR REPLACE FUNCTION check_and_award_milestones(p_user_id UUID)
RETURNS TABLE (milestone_id UUID, milestone_name TEXT, bonus_points INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consecutive_months INTEGER;
  v_milestone RECORD;
BEGIN
  -- Get current consecutive months
  SELECT consecutive_months INTO v_consecutive_months
  FROM student_subscriptions
  WHERE user_id = p_user_id AND status = 'active';

  IF v_consecutive_months IS NULL THEN
    RETURN;
  END IF;

  -- Find milestones to award
  FOR v_milestone IN
    SELECT m.*
    FROM loyalty_milestones m
    WHERE m.is_active = TRUE
      AND m.months_required <= v_consecutive_months
      AND NOT EXISTS (
        SELECT 1 FROM student_milestone_achievements a
        WHERE a.user_id = p_user_id AND a.milestone_id = m.id
      )
    ORDER BY m.months_required
  LOOP
    -- Record achievement
    INSERT INTO student_milestone_achievements (user_id, milestone_id, bonus_points_awarded)
    VALUES (p_user_id, v_milestone.id, v_milestone.bonus_points);

    -- Award bonus points
    IF v_milestone.bonus_points > 0 THEN
      PERFORM award_loyalty_points(
        p_user_id,
        v_milestone.bonus_points,
        'milestone_bonus',
        'Bonus for reaching ' || v_milestone.name,
        v_milestone.id,
        'milestone'
      );
    END IF;

    -- Auto-grant milestone rewards
    IF array_length(v_milestone.reward_ids, 1) > 0 THEN
      -- Insert redemptions for milestone rewards
      INSERT INTO reward_redemptions (
        user_id, reward_id, status, reward_type, reward_value, points_spent
      )
      SELECT
        p_user_id,
        r.id,
        'active',
        r.reward_type,
        r.value_config,
        0
      FROM rewards r
      WHERE r.id = ANY(v_milestone.reward_ids)
        AND r.is_active = TRUE;
    END IF;

    -- Return awarded milestone
    milestone_id := v_milestone.id;
    milestone_name := v_milestone.name;
    bonus_points := v_milestone.bonus_points;
    RETURN NEXT;
  END LOOP;
END;
$$;
```

### 2.4 Redeem Reward

```sql
CREATE OR REPLACE FUNCTION redeem_reward(
  p_user_id UUID,
  p_reward_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward RECORD;
  v_current_balance INTEGER;
  v_user_redemption_count INTEGER;
  v_redemption_id UUID;
  v_voucher_code TEXT;
  v_valid_until TIMESTAMPTZ;
BEGIN
  -- Lock reward row to prevent race conditions
  SELECT * INTO v_reward
  FROM rewards
  WHERE id = p_reward_id AND is_active = TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reward not found or not active';
  END IF;

  -- Check if milestone reward (can't be manually redeemed)
  IF v_reward.is_milestone_reward THEN
    RAISE EXCEPTION 'Milestone rewards are automatically granted';
  END IF;

  -- Check availability dates
  IF v_reward.available_from IS NOT NULL AND NOW() < v_reward.available_from THEN
    RAISE EXCEPTION 'Reward not yet available';
  END IF;

  IF v_reward.available_until IS NOT NULL AND NOW() > v_reward.available_until THEN
    RAISE EXCEPTION 'Reward no longer available';
  END IF;

  -- Check max redemptions
  IF v_reward.max_redemptions IS NOT NULL AND v_reward.current_redemptions >= v_reward.max_redemptions THEN
    RAISE EXCEPTION 'Reward has reached maximum redemptions';
  END IF;

  -- Check per-user limit
  SELECT COUNT(*) INTO v_user_redemption_count
  FROM reward_redemptions
  WHERE user_id = p_user_id AND reward_id = p_reward_id;

  IF v_reward.max_per_user IS NOT NULL AND v_user_redemption_count >= v_reward.max_per_user THEN
    RAISE EXCEPTION 'You have reached the maximum redemptions for this reward';
  END IF;

  -- Check cooldown
  IF v_reward.cooldown_days IS NOT NULL AND v_user_redemption_count > 0 THEN
    IF EXISTS (
      SELECT 1 FROM reward_redemptions
      WHERE user_id = p_user_id
        AND reward_id = p_reward_id
        AND created_at > NOW() - (v_reward.cooldown_days || ' days')::INTERVAL
    ) THEN
      RAISE EXCEPTION 'Cooldown period not elapsed for this reward';
    END IF;
  END IF;

  -- Check point balance
  v_current_balance := get_student_point_balance(p_user_id);
  IF v_current_balance < v_reward.point_cost THEN
    RAISE EXCEPTION 'Insufficient points. Required: %, Available: %', v_reward.point_cost, v_current_balance;
  END IF;

  -- Generate voucher code if needed
  IF v_reward.reward_type = 'voucher' THEN
    v_voucher_code := 'SP-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
    v_valid_until := NOW() + ((v_reward.value_config->>'valid_days')::INTEGER || ' days')::INTERVAL;
  ELSIF v_reward.reward_type IN ('priority_support', 'fee_discount') THEN
    v_valid_until := NOW() + ((v_reward.value_config->>'duration_days')::INTEGER || ' days')::INTERVAL;
  END IF;

  -- Deduct points
  PERFORM award_loyalty_points(
    p_user_id,
    -v_reward.point_cost,
    'redemption',
    'Redeemed: ' || v_reward.name,
    v_reward.id,
    'reward'
  );

  -- Create redemption record
  INSERT INTO reward_redemptions (
    user_id, reward_id, points_spent, status, reward_type, reward_value,
    voucher_code, valid_until
  ) VALUES (
    p_user_id, p_reward_id, v_reward.point_cost, 'active', v_reward.reward_type,
    v_reward.value_config, v_voucher_code, v_valid_until
  )
  RETURNING id INTO v_redemption_id;

  -- Update reward redemption count
  UPDATE rewards
  SET current_redemptions = current_redemptions + 1, updated_at = NOW()
  WHERE id = p_reward_id;

  RETURN v_redemption_id;
END;
$$;
```

---

## 3. Stripe Integration

### 3.1 Stripe Configuration

```typescript
// src/features/studentPlus/studentPlusTypes.ts

export const STUDENT_PLUS_CONFIG = {
  product: {
    productId: 'prod_student_plus',
    priceId: 'price_student_plus_990_eur_monthly',
    amount: 990, // €9.90 in cents
    currency: 'eur',
    interval: 'month',
  },
  trial: {
    enabled: false, // No trial per pricing model
    days: 0,
  },
  points: {
    perPayment: 50, // Points earned per monthly payment
    expirationDays: null, // Points don't expire (can be changed later)
  },
};

export type StudentSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';
```

### 3.2 Edge Function: student-plus-checkout

Creates a Stripe Checkout session for Student Plus subscription.

```typescript
// supabase/functions/student-plus-checkout/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@13?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
});

const STUDENT_PLUS_PRICE_ID = Deno.env.get('STRIPE_STUDENT_PLUS_PRICE_ID')!;

serve(async (req) => {
  try {
    // Verify JWT and get user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { successUrl, cancelUrl } = await req.json();

    // Check if user already has an active subscription
    const { data: existingSub } = await supabaseClient
      .from('student_subscriptions')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .single();

    if (existingSub) {
      return new Response(
        JSON.stringify({ error: 'Already subscribed to Student Plus' }),
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    let customerId: string;
    const { data: subRecord } = await supabaseClient
      .from('student_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (subRecord?.stripe_customer_id) {
      customerId = subRecord.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id,
          type: 'student_plus',
        },
      });
      customerId = customer.id;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: STUDENT_PLUS_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: user.id,
        type: 'student_plus_subscription',
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          type: 'student_plus',
        },
      },
    });

    return new Response(
      JSON.stringify({
        checkoutUrl: session.url,
        sessionId: session.id,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create checkout session' }),
      { status: 500 }
    );
  }
});
```

### 3.3 Edge Function: student-plus-portal

Creates Stripe Customer Portal session for subscription management.

```typescript
// supabase/functions/student-plus-portal/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@13?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
});

serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { returnUrl } = await req.json();

    // Get customer ID
    const { data: sub } = await supabaseClient
      .from('student_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (!sub?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: 'No subscription found' }),
        { status: 404 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: returnUrl,
    });

    return new Response(
      JSON.stringify({ portalUrl: session.url }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Portal error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create portal session' }),
      { status: 500 }
    );
  }
});
```

### 3.4 Webhook Handling (extend existing stripe-webhook)

Add handlers for Student Plus subscription events:

```typescript
// Add to supabase/functions/stripe-webhook/index.ts

// New handlers for student subscriptions
async function handleStudentSubscriptionCreated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.user_id;
  if (!userId || subscription.metadata.type !== 'student_plus') return;

  const supabase = createServiceClient();

  await supabase.from('student_subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: subscription.customer as string,
    stripe_subscription_id: subscription.id,
    stripe_price_id: subscription.items.data[0].price.id,
    status: subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    subscribed_since: new Date().toISOString(),
    consecutive_months: 0,
    total_months_subscribed: 0,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

async function handleStudentSubscriptionUpdated(subscription: Stripe.Subscription) {
  const supabase = createServiceClient();

  // Find subscription by Stripe ID
  const { data: sub } = await supabase
    .from('student_subscriptions')
    .select('*')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!sub) return;

  await supabase
    .from('student_subscriptions')
    .update({
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id);
}

async function handleStudentInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  const supabase = createServiceClient();

  // Find subscription
  const { data: sub } = await supabase
    .from('student_subscriptions')
    .select('*')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!sub) return;

  // Check if this is a Student Plus subscription
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  if (subscription.metadata.type !== 'student_plus') return;

  // Increment months
  const newConsecutive = sub.consecutive_months + 1;
  const newTotal = sub.total_months_subscribed + 1;

  await supabase
    .from('student_subscriptions')
    .update({
      consecutive_months: newConsecutive,
      total_months_subscribed: newTotal,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id);

  // Award loyalty points
  await supabase.rpc('award_loyalty_points', {
    p_user_id: sub.user_id,
    p_points: 50, // Points per payment
    p_transaction_type: 'subscription_payment',
    p_description: `Monthly subscription payment (month ${newTotal})`,
    p_reference_type: 'payment',
  });

  // Check for new milestones
  await supabase.rpc('check_and_award_milestones', {
    p_user_id: sub.user_id,
  });
}

async function handleStudentSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase = createServiceClient();

  await supabase
    .from('student_subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      consecutive_months: 0, // Reset consecutive on cancel
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);
}
```

---

## 4. Service Layer

### 4.1 Student Plus Service

```typescript
// src/features/studentPlus/studentPlusService.ts

import { supabase } from '@/lib/supabaseClient';
import type {
  StudentSubscription,
  LoyaltyPointsBalance,
  Reward,
  RewardRedemption,
  MilestoneAchievement
} from './studentPlusTypes';

export const studentPlusService = {
  // Subscription Management
  async getSubscription(): Promise<StudentSubscription | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('student_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async createCheckoutSession(successUrl: string, cancelUrl: string) {
    const { data, error } = await supabase.functions.invoke('student-plus-checkout', {
      body: { successUrl, cancelUrl },
    });

    if (error) throw error;
    return data;
  },

  async createPortalSession(returnUrl: string) {
    const { data, error } = await supabase.functions.invoke('student-plus-portal', {
      body: { returnUrl },
    });

    if (error) throw error;
    return data;
  },

  // Points & Rewards
  async getPointsBalance(): Promise<LoyaltyPointsBalance> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('student_point_balances')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return data || {
      user_id: user.id,
      total_points: 0,
      total_spent: 0,
      total_earned: 0,
    };
  },

  async getPointsHistory(limit = 20, offset = 0) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('loyalty_points')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data;
  },

  // Rewards
  async getAvailableRewards(): Promise<Reward[]> {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('is_active', true)
      .eq('is_milestone_reward', false)
      .order('display_order');

    if (error) throw error;
    return data;
  },

  async redeemReward(rewardId: string): Promise<RewardRedemption> {
    const { data, error } = await supabase.rpc('redeem_reward', {
      p_user_id: (await supabase.auth.getUser()).data.user!.id,
      p_reward_id: rewardId,
    });

    if (error) throw error;

    // Fetch the created redemption
    const { data: redemption } = await supabase
      .from('reward_redemptions')
      .select('*')
      .eq('id', data)
      .single();

    return redemption;
  },

  async getMyRedemptions(): Promise<RewardRedemption[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('reward_redemptions')
      .select('*, reward:rewards(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Milestones
  async getMilestones() {
    const { data, error } = await supabase
      .from('loyalty_milestones')
      .select('*')
      .eq('is_active', true)
      .order('months_required');

    if (error) throw error;
    return data;
  },

  async getMyAchievements(): Promise<MilestoneAchievement[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('student_milestone_achievements')
      .select('*, milestone:loyalty_milestones(*)')
      .eq('user_id', user.id)
      .order('achieved_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Check subscription status
  async isSubscribed(): Promise<boolean> {
    const sub = await this.getSubscription();
    return sub?.status === 'active' || sub?.status === 'trialing';
  },

  // Validate voucher code
  async validateVoucherCode(code: string): Promise<RewardRedemption | null> {
    const { data, error } = await supabase
      .from('reward_redemptions')
      .select('*')
      .eq('voucher_code', code)
      .eq('status', 'active')
      .single();

    if (error) return null;

    // Check if voucher is still valid
    if (data.valid_until && new Date(data.valid_until) < new Date()) {
      return null;
    }

    return data;
  },
};
```

---

## 5. UI Components

### 5.1 Component Structure

```
src/features/studentPlus/
├── components/
│   ├── StudentPlusPage.tsx          # Main landing/subscription page
│   ├── LoyaltyDashboard.tsx         # Points, milestones, stats
│   ├── RewardsPage.tsx              # Browse and redeem rewards
│   ├── MilestoneProgress.tsx        # Visual milestone tracker
│   ├── PointsHistory.tsx            # Transaction history
│   ├── RewardCard.tsx               # Individual reward display
│   ├── RedemptionCard.tsx           # Active/past redemption
│   ├── SubscriptionStatus.tsx       # Current subscription info
│   └── StudentPlusBadge.tsx         # Badge display component
├── hooks/
│   ├── useStudentSubscription.ts    # Subscription state hook
│   ├── useLoyaltyPoints.ts          # Points balance hook
│   └── useRewards.ts                # Rewards data hook
├── studentPlusService.ts
├── studentPlusTypes.ts
└── index.ts
```

### 5.2 StudentPlusPage Component

```tsx
// src/features/studentPlus/components/StudentPlusPage.tsx

import { useState } from 'react';
import { useStudentSubscription } from '../hooks/useStudentSubscription';
import { studentPlusService } from '../studentPlusService';
import { LoyaltyDashboard } from './LoyaltyDashboard';
import { SubscriptionStatus } from './SubscriptionStatus';

export function StudentPlusPage() {
  const { subscription, isLoading, isSubscribed } = useStudentSubscription();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const handleSubscribe = async () => {
    setIsCheckingOut(true);
    try {
      const { checkoutUrl } = await studentPlusService.createCheckoutSession(
        `${window.location.origin}/student-plus?success=true`,
        `${window.location.origin}/student-plus?canceled=true`
      );
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Checkout error:', error);
      setIsCheckingOut(false);
    }
  };

  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  if (isSubscribed) {
    return (
      <div className="space-y-8">
        <SubscriptionStatus subscription={subscription!} />
        <LoyaltyDashboard />
      </div>
    );
  }

  // Non-subscriber view - sales page
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Student Plus</h1>
        <p className="text-xl text-gray-600 mb-2">
          Your membership to entrepreneurial success
        </p>
        <div className="text-3xl font-bold text-primary">
          €9.90<span className="text-base font-normal text-gray-500">/month</span>
        </div>
      </div>

      {/* Benefits */}
      <div className="grid md:grid-cols-2 gap-6 mb-12">
        <BenefitCard
          icon="📬"
          title="Exclusive Newsletter"
          description="Private entrepreneurship & business practical insights delivered to your inbox"
        />
        <BenefitCard
          icon="🎯"
          title="Community Perks"
          description="Exclusive access to premium community features and content"
        />
        <BenefitCard
          icon="🏆"
          title="Loyalty Rewards"
          description="Earn points every month and unlock rewards at 3, 6, 9, and 12-month milestones"
        />
        <BenefitCard
          icon="🎁"
          title="Redeem Rewards"
          description="Use points for discounts, template packs, priority support, and more"
        />
      </div>

      {/* Milestone preview */}
      <div className="bg-gray-50 rounded-xl p-8 mb-12">
        <h2 className="text-2xl font-bold mb-6 text-center">Loyalty Milestones</h2>
        <div className="flex justify-between items-center">
          <MilestonePreview emoji="🥉" months={3} bonus={100} />
          <div className="h-1 flex-1 bg-gray-200 mx-2" />
          <MilestonePreview emoji="🥈" months={6} bonus={250} />
          <div className="h-1 flex-1 bg-gray-200 mx-2" />
          <MilestonePreview emoji="🥇" months={9} bonus={500} />
          <div className="h-1 flex-1 bg-gray-200 mx-2" />
          <MilestonePreview emoji="💎" months={12} bonus={1000} />
        </div>
      </div>

      {/* CTA */}
      <div className="text-center">
        <button
          onClick={handleSubscribe}
          disabled={isCheckingOut}
          className="bg-primary text-white px-8 py-4 rounded-lg text-xl font-semibold hover:bg-primary-dark transition disabled:opacity-50"
        >
          {isCheckingOut ? 'Redirecting...' : 'Start Your Journey'}
        </button>
        <p className="text-sm text-gray-500 mt-3">
          Cancel anytime. No questions asked.
        </p>
      </div>
    </div>
  );
}

function BenefitCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-white p-6 rounded-xl border shadow-sm">
      <span className="text-3xl mb-3 block">{icon}</span>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function MilestonePreview({ emoji, months, bonus }: { emoji: string; months: number; bonus: number }) {
  return (
    <div className="text-center">
      <span className="text-3xl block mb-2">{emoji}</span>
      <div className="font-semibold">{months} months</div>
      <div className="text-sm text-gray-500">+{bonus} pts</div>
    </div>
  );
}
```

### 5.3 LoyaltyDashboard Component

```tsx
// src/features/studentPlus/components/LoyaltyDashboard.tsx

import { useLoyaltyPoints } from '../hooks/useLoyaltyPoints';
import { MilestoneProgress } from './MilestoneProgress';
import { PointsHistory } from './PointsHistory';
import { Link } from 'react-router-dom';

export function LoyaltyDashboard() {
  const { balance, isLoading } = useLoyaltyPoints();

  if (isLoading) {
    return <div className="animate-pulse h-48 bg-gray-100 rounded-xl" />;
  }

  return (
    <div className="space-y-6">
      {/* Points Balance Card */}
      <div className="bg-gradient-to-r from-primary to-primary-dark text-white rounded-xl p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg opacity-90">Your Points</h2>
            <div className="text-4xl font-bold">{balance.total_points.toLocaleString()}</div>
          </div>
          <Link
            to="/student-plus/rewards"
            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition"
          >
            Redeem Rewards →
          </Link>
        </div>
        <div className="mt-4 flex gap-6 text-sm opacity-80">
          <div>Total Earned: {balance.total_earned.toLocaleString()}</div>
          <div>Total Spent: {balance.total_spent.toLocaleString()}</div>
        </div>
      </div>

      {/* Milestone Progress */}
      <MilestoneProgress />

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-lg mb-4">Recent Activity</h3>
        <PointsHistory limit={5} />
      </div>
    </div>
  );
}
```

### 5.4 RewardsPage Component

```tsx
// src/features/studentPlus/components/RewardsPage.tsx

import { useState } from 'react';
import { useRewards } from '../hooks/useRewards';
import { useLoyaltyPoints } from '../hooks/useLoyaltyPoints';
import { studentPlusService } from '../studentPlusService';
import { RewardCard } from './RewardCard';
import { RedemptionCard } from './RedemptionCard';

export function RewardsPage() {
  const { rewards, myRedemptions, isLoading, refetch } = useRewards();
  const { balance } = useLoyaltyPoints();
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'available' | 'my-rewards'>('available');

  const handleRedeem = async (rewardId: string) => {
    setRedeeming(rewardId);
    try {
      await studentPlusService.redeemReward(rewardId);
      refetch();
    } catch (error) {
      console.error('Redemption error:', error);
      alert(error instanceof Error ? error.message : 'Failed to redeem reward');
    } finally {
      setRedeeming(null);
    }
  };

  if (isLoading) {
    return <div className="animate-pulse">Loading rewards...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Rewards</h1>
        <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg font-semibold">
          {balance.total_points.toLocaleString()} points available
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab('available')}
          className={`pb-3 px-1 font-medium ${
            activeTab === 'available'
              ? 'border-b-2 border-primary text-primary'
              : 'text-gray-500'
          }`}
        >
          Available Rewards
        </button>
        <button
          onClick={() => setActiveTab('my-rewards')}
          className={`pb-3 px-1 font-medium ${
            activeTab === 'my-rewards'
              ? 'border-b-2 border-primary text-primary'
              : 'text-gray-500'
          }`}
        >
          My Rewards ({myRedemptions.length})
        </button>
      </div>

      {activeTab === 'available' ? (
        <div className="grid md:grid-cols-2 gap-4">
          {rewards.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              userPoints={balance.total_points}
              onRedeem={() => handleRedeem(reward.id)}
              isRedeeming={redeeming === reward.id}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {myRedemptions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              You haven't redeemed any rewards yet.
            </p>
          ) : (
            myRedemptions.map((redemption) => (
              <RedemptionCard key={redemption.id} redemption={redemption} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 6. User Flows

### 6.1 Subscribe to Student Plus

```
Student → StudentPlusPage (non-subscriber view)
  ↓
Click "Start Your Journey"
  ↓
studentPlusService.createCheckoutSession()
  ↓
Edge Function: student-plus-checkout
  ↓
Stripe Checkout (hosted page)
  ↓
Success → Stripe webhook: checkout.session.completed
  ↓
Create student_subscriptions record
  ↓
Redirect to StudentPlusPage (subscriber view)
  ↓
Show LoyaltyDashboard
```

### 6.2 Earn Points (Monthly)

```
Stripe → invoice.paid webhook
  ↓
Edge Function: stripe-webhook
  ↓
handleStudentInvoicePaid()
  ↓
Update consecutive_months, total_months_subscribed
  ↓
award_loyalty_points() → +50 points
  ↓
check_and_award_milestones()
  ↓
If milestone reached:
  - Insert achievement
  - Award bonus points
  - Auto-grant milestone rewards
```

### 6.3 Redeem Reward

```
Student → RewardsPage
  ↓
Browse available rewards
  ↓
Click "Redeem" on reward
  ↓
studentPlusService.redeemReward(rewardId)
  ↓
Database: redeem_reward() function
  - Validate eligibility
  - Check point balance
  - Generate voucher code (if applicable)
  - Deduct points
  - Create redemption record
  ↓
Return to RewardsPage → "My Rewards" tab
  ↓
Show redemption with voucher code / activation status
```

### 6.4 Cancel Subscription

```
Student → SubscriptionStatus → "Manage Subscription"
  ↓
studentPlusService.createPortalSession()
  ↓
Stripe Customer Portal
  ↓
Cancel subscription
  ↓
Webhook: customer.subscription.updated (cancel_at_period_end = true)
  ↓
Update student_subscriptions
  ↓
Subscription remains active until period end
  ↓
Webhook: customer.subscription.deleted
  ↓
Set status = 'canceled', reset consecutive_months
  ↓
Points remain (don't expire on cancel)
Active rewards remain valid until their expiration
```

---

## 7. Integration Points

### 7.1 Profile Integration

Add Student Plus badge to user profiles:

```tsx
// In profile components
import { StudentPlusBadge } from '@/features/studentPlus';

// Show badge if subscribed
{isStudentPlus && <StudentPlusBadge achievements={achievements} />}
```

### 7.2 Course Purchase Integration

Apply voucher discount at checkout:

```typescript
// In course purchase flow
async function applyCouponCode(code: string) {
  const redemption = await studentPlusService.validateVoucherCode(code);
  if (!redemption) {
    throw new Error('Invalid or expired voucher code');
  }

  const discount = redemption.reward_value.discount_percent;
  return { discount, redemptionId: redemption.id };
}

// After successful purchase, mark voucher as used
async function markVoucherUsed(redemptionId: string, courseId: string) {
  await supabase
    .from('reward_redemptions')
    .update({
      status: 'used',
      used_at: new Date().toISOString(),
      used_for_reference: courseId,
    })
    .eq('id', redemptionId);
}
```

### 7.3 Priority Support Integration

Check for active priority support when creating support tickets:

```typescript
async function hasPrioritySupport(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('reward_redemptions')
    .select('id')
    .eq('user_id', userId)
    .eq('reward_type', 'priority_support')
    .eq('status', 'active')
    .gt('valid_until', new Date().toISOString())
    .single();

  return !!data;
}
```

---

## 8. Open Questions & Recommendations

### 8.1 Point Expiration Policy

**Current Design**: Points don't expire
**Recommendation**: Keep no expiration for MVP. Consider adding 12-month expiration in future for financial liability management.

### 8.2 Point Transfer on Subscription Cancel

**Current Design**: Points remain when subscription canceled
**Recommendation**: Keep this behavior - it incentivizes re-subscription and doesn't penalize users for temporary churn.

### 8.3 First Month Discount

**Not implemented**: Pricing model doesn't specify a trial or discount
**Recommendation**: Consider adding "First month 50% off" (€4.95) in future to lower barrier to entry.

### 8.4 Referral Program

**Not implemented**: Would require additional tables and logic
**Recommendation**: Add as Phase 3 feature - referral system where students earn points for successful referrals.

### 8.5 Point Earning Beyond Payments

**Current**: Only earns from monthly payments and milestones
**Future consideration**: Add `engagement` point type for:
- Completing courses
- Writing reviews
- Community participation
- Referring new members

---

## 9. Migration Strategy

### Phase 2A: Database & Edge Functions
1. Run database migration (new tables, functions, RLS)
2. Deploy Edge Functions (student-plus-checkout, student-plus-portal)
3. Update stripe-webhook with Student Plus handlers
4. Create Stripe Product and Price in dashboard

### Phase 2B: Frontend
1. Implement service layer and hooks
2. Build UI components
3. Add routes to application
4. Integrate with existing profile system

### Phase 2C: Testing & Launch
1. Test complete flow in Stripe test mode
2. Verify webhook handling
3. Test milestone and reward logic
4. Switch to live mode and launch

---

## 10. Summary

The Student Plus system extends the Creator Club platform with a student-focused subscription that:

- **Monetizes the student segment** at €9.9/month
- **Builds loyalty** through milestone rewards at 3/6/9/12 months
- **Increases engagement** with redeemable rewards
- **Creates network effects** through exclusive perks and content

The architecture follows established patterns from Phase 1 (Creator billing), ensuring consistency and maintainability while adding student-specific functionality.
