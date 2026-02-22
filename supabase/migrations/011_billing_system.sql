-- ============================================================================
-- CREATOR CLUB - BILLING SYSTEM SCHEMA
-- ============================================================================
-- Migration: 011_billing_system.sql
-- Created: 2025-12-29
-- Author: Implementer-DB Agent
--
-- This migration creates all billing tables for the Creator Club platform:
-- - billing_plans: Master plan configuration (Starter/Pro/Scale)
-- - creator_billing: Per-creator billing state with Stripe IDs
-- - billing_transactions: Immutable transaction ledger
-- - creator_sales: Sales tracking for platform fee calculation
-- - webhook_events: Idempotent webhook event log
--
-- Pricing Model:
-- | Plan    | Monthly Fee | Platform Fee | Monthly Fee Trigger |
-- |---------|-------------|--------------|---------------------|
-- | Starter | EUR 0       | 6.9%         | N/A (always free)   |
-- | Pro     | EUR 30      | 3.9%         | After 1st sale      |
-- | Scale   | EUR 99      | 1.9%         | After 1st sale      |
--
-- Activation Fee: EUR 2.9 (one-time, on registration)
-- ============================================================================

-- ============================================================================
-- SECTION 1: CREATE CUSTOM TYPES
-- ============================================================================

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
  'activation_fee',     -- One-time EUR 2.9 activation
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

-- ============================================================================
-- SECTION 2: CREATE TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE 1: billing_plans
-- Master plan configuration (seeded, rarely changed)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- TABLE 2: creator_billing
-- Creator-specific billing state (extends profiles)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- TABLE 3: billing_transactions
-- Immutable ledger of all billing events
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- TABLE 4: creator_sales
-- Track creator product/course sales for platform fee calculation
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- TABLE 5: webhook_events
-- Idempotent webhook processing log
-- ----------------------------------------------------------------------------
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

-- ============================================================================
-- SECTION 3: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 4: ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RLS: billing_plans
-- Readable by all authenticated users (public pricing info)
-- ----------------------------------------------------------------------------
CREATE POLICY "Plans readable by authenticated users"
  ON public.billing_plans FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Only service role can modify plans"
  ON public.billing_plans FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ----------------------------------------------------------------------------
-- RLS: creator_billing
-- Only creator can see and update their own billing
-- ----------------------------------------------------------------------------
CREATE POLICY "Creators can view own billing"
  ON public.creator_billing FOR SELECT
  USING (creator_id = auth.uid());

CREATE POLICY "Creators can update own billing"
  ON public.creator_billing FOR UPDATE
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Creators can insert own billing"
  ON public.creator_billing FOR INSERT
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Service role can manage all billing"
  ON public.creator_billing FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Superadmins can view all creator billing
CREATE POLICY "Superadmins can view all creator billing"
  ON public.creator_billing FOR SELECT
  USING ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'superadmin');

-- ----------------------------------------------------------------------------
-- RLS: billing_transactions
-- Creator can view their transactions
-- ----------------------------------------------------------------------------
CREATE POLICY "Creators can view own transactions"
  ON public.billing_transactions FOR SELECT
  USING (creator_id = auth.uid());

CREATE POLICY "Service role can manage all transactions"
  ON public.billing_transactions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Superadmins can view all transactions
CREATE POLICY "Superadmins can view all transactions"
  ON public.billing_transactions FOR SELECT
  USING ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'superadmin');

-- ----------------------------------------------------------------------------
-- RLS: creator_sales
-- Creator can view their sales, buyers can view their purchases
-- ----------------------------------------------------------------------------
CREATE POLICY "Creators can view own sales"
  ON public.creator_sales FOR SELECT
  USING (creator_id = auth.uid());

CREATE POLICY "Buyers can view own purchases"
  ON public.creator_sales FOR SELECT
  USING (buyer_id = auth.uid());

CREATE POLICY "Service role can manage all sales"
  ON public.creator_sales FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Superadmins can view all sales
CREATE POLICY "Superadmins can view all sales"
  ON public.creator_sales FOR SELECT
  USING ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'superadmin');

-- ----------------------------------------------------------------------------
-- RLS: webhook_events
-- Service role only (webhooks are server-side only)
-- ----------------------------------------------------------------------------
CREATE POLICY "Service role only for webhooks"
  ON public.webhook_events FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- SECTION 5: GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant permissions on new tables
GRANT SELECT ON public.billing_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.creator_billing TO authenticated;
GRANT SELECT ON public.billing_transactions TO authenticated;
GRANT SELECT ON public.creator_sales TO authenticated;
-- webhook_events is service_role only, no grants to authenticated

-- Grant usage on custom types
GRANT USAGE ON TYPE plan_tier TO authenticated;
GRANT USAGE ON TYPE billing_status TO authenticated;
GRANT USAGE ON TYPE transaction_type TO authenticated;
GRANT USAGE ON TYPE transaction_status TO authenticated;

-- ============================================================================
-- SECTION 6: UPDATE TRIGGERS
-- ============================================================================

-- Trigger for creator_billing updated_at
CREATE TRIGGER update_creator_billing_updated_at
  BEFORE UPDATE ON public.creator_billing
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for billing_plans updated_at
CREATE TRIGGER update_billing_plans_updated_at
  BEFORE UPDATE ON public.billing_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- SECTION 7: SEED DATA - Billing Plans
-- ============================================================================

INSERT INTO public.billing_plans (tier, name, description, price_monthly_cents, platform_fee_percent, features)
VALUES
  (
    'starter',
    'Starter',
    'Perfect for getting started. No monthly fee, pay only when you earn.',
    0,
    6.90,
    '{
      "max_students": 50,
      "max_courses": 2,
      "max_communities": 1,
      "ai_enabled": true,
      "custom_branding": false,
      "priority_support": false,
      "white_label": false,
      "advanced_analytics": false,
      "api_access": false
    }'::jsonb
  ),
  (
    'pro',
    'Pro',
    'For growing creators. Lower platform fees with more features.',
    3000,
    3.90,
    '{
      "max_students": 500,
      "max_courses": 10,
      "max_communities": 3,
      "ai_enabled": true,
      "custom_branding": true,
      "priority_support": true,
      "white_label": false,
      "advanced_analytics": true,
      "api_access": false
    }'::jsonb
  ),
  (
    'scale',
    'Scale',
    'For serious creators. Lowest fees with unlimited access.',
    9900,
    1.90,
    '{
      "max_students": -1,
      "max_courses": -1,
      "max_communities": -1,
      "ai_enabled": true,
      "custom_branding": true,
      "priority_support": true,
      "white_label": true,
      "advanced_analytics": true,
      "api_access": true
    }'::jsonb
  );

-- ============================================================================
-- SECTION 8: HELPER FUNCTIONS
-- ============================================================================

-- Function to get a creator's current plan tier
CREATE OR REPLACE FUNCTION public.get_creator_plan_tier(p_creator_id UUID)
RETURNS plan_tier AS $$
DECLARE
  v_tier plan_tier;
BEGIN
  SELECT bp.tier INTO v_tier
  FROM public.creator_billing cb
  JOIN public.billing_plans bp ON bp.id = cb.plan_id
  WHERE cb.creator_id = p_creator_id;

  RETURN COALESCE(v_tier, 'starter'::plan_tier);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a creator can add more students
CREATE OR REPLACE FUNCTION public.can_creator_add_student(p_creator_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_max_students INTEGER;
  v_current_students INTEGER;
BEGIN
  -- Get max students from plan
  SELECT (bp.features->>'max_students')::INTEGER INTO v_max_students
  FROM public.creator_billing cb
  JOIN public.billing_plans bp ON bp.id = cb.plan_id
  WHERE cb.creator_id = p_creator_id;

  -- -1 means unlimited
  IF v_max_students = -1 THEN
    RETURN true;
  END IF;

  -- Count current students across all creator's communities
  SELECT COUNT(DISTINCT m.user_id) INTO v_current_students
  FROM public.memberships m
  JOIN public.communities c ON c.id = m.community_id
  WHERE c.creator_id = p_creator_id
    AND m.role = 'member';

  RETURN v_current_students < COALESCE(v_max_students, 50);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a creator can add more courses
CREATE OR REPLACE FUNCTION public.can_creator_add_course(p_creator_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_max_courses INTEGER;
  v_current_courses INTEGER;
BEGIN
  -- Get max courses from plan
  SELECT (bp.features->>'max_courses')::INTEGER INTO v_max_courses
  FROM public.creator_billing cb
  JOIN public.billing_plans bp ON bp.id = cb.plan_id
  WHERE cb.creator_id = p_creator_id;

  -- -1 means unlimited
  IF v_max_courses = -1 THEN
    RETURN true;
  END IF;

  -- Count current courses
  SELECT COUNT(*) INTO v_current_courses
  FROM public.courses
  WHERE creator_id = p_creator_id;

  RETURN v_current_courses < COALESCE(v_max_courses, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a creator can add more communities
CREATE OR REPLACE FUNCTION public.can_creator_add_community(p_creator_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_max_communities INTEGER;
  v_current_communities INTEGER;
BEGIN
  -- Get max communities from plan
  SELECT (bp.features->>'max_communities')::INTEGER INTO v_max_communities
  FROM public.creator_billing cb
  JOIN public.billing_plans bp ON bp.id = cb.plan_id
  WHERE cb.creator_id = p_creator_id;

  -- -1 means unlimited
  IF v_max_communities = -1 THEN
    RETURN true;
  END IF;

  -- Count current communities
  SELECT COUNT(*) INTO v_current_communities
  FROM public.communities
  WHERE creator_id = p_creator_id;

  RETURN v_current_communities < COALESCE(v_max_communities, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate platform fee for a sale
CREATE OR REPLACE FUNCTION public.calculate_platform_fee(
  p_creator_id UUID,
  p_sale_amount_cents INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_fee_percent DECIMAL(4,2);
  v_fee_cents INTEGER;
BEGIN
  -- Get platform fee percentage from creator's plan
  SELECT bp.platform_fee_percent INTO v_fee_percent
  FROM public.creator_billing cb
  JOIN public.billing_plans bp ON bp.id = cb.plan_id
  WHERE cb.creator_id = p_creator_id;

  -- Default to Starter fee if no billing record
  v_fee_percent := COALESCE(v_fee_percent, 6.90);

  -- Calculate fee (round up to nearest cent)
  v_fee_cents := CEIL(p_sale_amount_cents * v_fee_percent / 100.0);

  RETURN v_fee_cents;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
DECLARE
  table_count INTEGER;
  policy_count INTEGER;
  plan_count INTEGER;
BEGIN
  -- Count new tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'billing_plans', 'creator_billing', 'billing_transactions',
      'creator_sales', 'webhook_events'
    );

  -- Count policies on billing tables
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'billing_plans', 'creator_billing', 'billing_transactions',
      'creator_sales', 'webhook_events'
    );

  -- Count seeded plans
  SELECT COUNT(*) INTO plan_count
  FROM public.billing_plans;

  RAISE NOTICE '================================================';
  RAISE NOTICE 'Migration 011: Billing System Schema COMPLETE';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Tables created: %', table_count;
  RAISE NOTICE 'RLS policies: %', policy_count;
  RAISE NOTICE 'Custom types: 4 (plan_tier, billing_status, transaction_type, transaction_status)';
  RAISE NOTICE 'Plans seeded: % (Starter, Pro, Scale)', plan_count;
  RAISE NOTICE 'Helper functions: 5';
  RAISE NOTICE '';
  RAISE NOTICE 'Pricing Model:';
  RAISE NOTICE '  Starter: EUR 0/mo, 6.9%% platform fee';
  RAISE NOTICE '  Pro: EUR 30/mo, 3.9%% platform fee';
  RAISE NOTICE '  Scale: EUR 99/mo, 1.9%% platform fee';
  RAISE NOTICE '';
  RAISE NOTICE 'Status: READY FOR BILLING INTEGRATION';
  RAISE NOTICE '================================================';
END $$;
