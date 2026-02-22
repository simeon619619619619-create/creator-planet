-- ============================================================================
-- CREATOR CLUB - COMMUNITY MONETIZATION SCHEMA
-- ============================================================================
-- Migration: 013_community_monetization.sql
-- Created: 2026-01-04
--
-- This migration adds monetization capabilities to communities:
-- - Pricing type (free, one-time, monthly subscription)
-- - Stripe integration for payments
-- - Payment tracking on memberships
-- - Purchase history for audit trail
--
-- Pricing Options:
-- | Type      | Description                        | Stripe Integration    |
-- |-----------|------------------------------------|-----------------------|
-- | free      | No payment required                | None                  |
-- | one_time  | Single payment for lifetime access | Payment Intent        |
-- | monthly   | Recurring subscription             | Subscription          |
--
-- Money Flow (via Stripe Connect):
-- Student pays -> Stripe -> Platform fee deducted -> Creator receives net
-- ============================================================================

-- ============================================================================
-- SECTION 1: CREATE CUSTOM TYPES
-- ============================================================================

-- Pricing type enum for communities
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'community_pricing_type') THEN
    CREATE TYPE public.community_pricing_type AS ENUM ('free', 'one_time', 'monthly');
  END IF;
END$$;

-- ============================================================================
-- SECTION 2: ALTER COMMUNITIES TABLE
-- ============================================================================

-- Add pricing columns to communities table
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS pricing_type public.community_pricing_type DEFAULT 'free' NOT NULL,
  ADD COLUMN IF NOT EXISTS price_cents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- Add constraint for price validation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_community_price' AND conrelid = 'public.communities'::regclass
  ) THEN
    ALTER TABLE public.communities
    ADD CONSTRAINT valid_community_price CHECK (price_cents >= 0);
  END IF;
END$$;

-- Add constraint to ensure paid communities have a price
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'paid_community_has_price' AND conrelid = 'public.communities'::regclass
  ) THEN
    ALTER TABLE public.communities
    ADD CONSTRAINT paid_community_has_price CHECK (
      (pricing_type = 'free' AND price_cents = 0) OR
      (pricing_type != 'free' AND price_cents > 0)
    );
  END IF;
END$$;

-- Add indexes for pricing queries
CREATE INDEX IF NOT EXISTS communities_pricing_type_idx ON public.communities(pricing_type);
CREATE INDEX IF NOT EXISTS communities_stripe_product_id_idx ON public.communities(stripe_product_id);

COMMENT ON COLUMN public.communities.pricing_type IS 'Pricing model: free, one_time (lifetime), or monthly (subscription)';
COMMENT ON COLUMN public.communities.price_cents IS 'Price in currency minor units (e.g., cents). 0 for free communities.';
COMMENT ON COLUMN public.communities.currency IS 'ISO 4217 currency code (default EUR)';
COMMENT ON COLUMN public.communities.stripe_product_id IS 'Stripe Product ID for this community';
COMMENT ON COLUMN public.communities.stripe_price_id IS 'Stripe Price ID for this community';

-- ============================================================================
-- SECTION 3: ALTER MEMBERSHIPS TABLE
-- ============================================================================

-- Add payment tracking columns to memberships table
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add constraint for valid payment status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_payment_status' AND conrelid = 'public.memberships'::regclass
  ) THEN
    ALTER TABLE public.memberships
    ADD CONSTRAINT valid_payment_status CHECK (
      payment_status IN ('none', 'pending', 'paid', 'failed', 'canceled')
    );
  END IF;
END$$;

-- Add indexes for payment queries
CREATE INDEX IF NOT EXISTS memberships_payment_status_idx ON public.memberships(payment_status);
CREATE INDEX IF NOT EXISTS memberships_stripe_subscription_id_idx ON public.memberships(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS memberships_expires_at_idx ON public.memberships(expires_at);

COMMENT ON COLUMN public.memberships.payment_status IS 'Payment state: none (free), pending, paid, failed, canceled';
COMMENT ON COLUMN public.memberships.stripe_subscription_id IS 'Stripe Subscription ID for monthly memberships';
COMMENT ON COLUMN public.memberships.stripe_payment_intent_id IS 'Stripe Payment Intent ID for one-time payments';
COMMENT ON COLUMN public.memberships.paid_at IS 'Timestamp when payment was completed';
COMMENT ON COLUMN public.memberships.expires_at IS 'When access expires (null for lifetime/free access)';

-- ============================================================================
-- SECTION 4: CREATE COMMUNITY_PURCHASES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.community_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  membership_id UUID REFERENCES public.memberships(id) ON DELETE SET NULL,

  -- Transaction details
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  creator_net_cents INTEGER GENERATED ALWAYS AS (amount_cents - platform_fee_cents) STORED,

  -- Stripe references
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  stripe_subscription_id TEXT,
  stripe_invoice_id TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ
);

-- Add constraint for valid purchase status
ALTER TABLE public.community_purchases
ADD CONSTRAINT valid_purchase_status CHECK (
  status IN ('pending', 'completed', 'failed', 'refunded')
);

-- Add constraint for positive amounts
ALTER TABLE public.community_purchases
ADD CONSTRAINT valid_purchase_amount CHECK (amount_cents > 0);

-- Indexes
CREATE INDEX IF NOT EXISTS community_purchases_community_id_idx ON public.community_purchases(community_id);
CREATE INDEX IF NOT EXISTS community_purchases_member_id_idx ON public.community_purchases(member_id);
CREATE INDEX IF NOT EXISTS community_purchases_membership_id_idx ON public.community_purchases(membership_id);
CREATE INDEX IF NOT EXISTS community_purchases_status_idx ON public.community_purchases(status);
CREATE INDEX IF NOT EXISTS community_purchases_created_at_idx ON public.community_purchases(created_at DESC);
CREATE INDEX IF NOT EXISTS community_purchases_stripe_checkout_session_idx ON public.community_purchases(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS community_purchases_stripe_payment_intent_idx ON public.community_purchases(stripe_payment_intent_id);

COMMENT ON TABLE public.community_purchases IS 'All community membership purchases with platform fee tracking';
COMMENT ON COLUMN public.community_purchases.amount_cents IS 'Total amount paid in currency minor units';
COMMENT ON COLUMN public.community_purchases.platform_fee_cents IS 'Platform fee (based on creator plan tier)';
COMMENT ON COLUMN public.community_purchases.creator_net_cents IS 'Amount creator receives (computed: amount - platform_fee)';
COMMENT ON COLUMN public.community_purchases.status IS 'Purchase state: pending, completed, failed, refunded';

-- ============================================================================
-- SECTION 5: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.community_purchases ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 6: ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RLS: communities (additional policies for pricing info)
-- Note: Base policies exist in 004_phase2_schema.sql
-- ----------------------------------------------------------------------------

-- Anon users can view pricing info for public communities (for landing pages)
DROP POLICY IF EXISTS "Anon can view public community pricing" ON public.communities;
CREATE POLICY "Anon can view public community pricing"
  ON public.communities FOR SELECT
  TO anon
  USING (is_public = true);

-- Authenticated users can view pricing info for public communities
DROP POLICY IF EXISTS "Authenticated can view public community pricing" ON public.communities;
CREATE POLICY "Authenticated can view public community pricing"
  ON public.communities FOR SELECT
  TO authenticated
  USING (is_public = true);

-- ----------------------------------------------------------------------------
-- RLS: memberships (additional policies for payment columns)
-- Note: Base policies exist in 004_phase2_schema.sql
-- Users can already view their own memberships via existing policy
-- ----------------------------------------------------------------------------

-- No additional policies needed - existing "Users can view own memberships"
-- policy allows members to see their payment status

-- ----------------------------------------------------------------------------
-- RLS: community_purchases
-- ----------------------------------------------------------------------------

-- Members can view their own purchases
-- Note: member_id references profiles.id, so use get_my_profile_id()
CREATE POLICY "Members can view own purchases"
  ON public.community_purchases FOR SELECT
  TO authenticated
  USING (member_id = get_my_profile_id());

-- Creators can view purchases for their communities
-- Note: creator_id references profiles.id, so use get_my_profile_id()
CREATE POLICY "Creators can view community purchases"
  ON public.community_purchases FOR SELECT
  TO authenticated
  USING (
    community_id IN (
      SELECT id FROM public.communities
      WHERE creator_id = get_my_profile_id()
    )
  );

-- Service role can manage all purchases (for webhooks)
CREATE POLICY "Service role can manage all purchases"
  ON public.community_purchases FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Superadmins can view all purchases
CREATE POLICY "Superadmins can view all purchases"
  ON public.community_purchases FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'superadmin');

-- ============================================================================
-- SECTION 7: GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on new type
GRANT USAGE ON TYPE public.community_pricing_type TO authenticated;
GRANT USAGE ON TYPE public.community_pricing_type TO anon;

-- Grant permissions on new table
GRANT SELECT ON public.community_purchases TO authenticated;

-- ============================================================================
-- SECTION 8: HELPER FUNCTIONS
-- ============================================================================

-- Function to check if a user has valid access to a community
-- Note: p_profile_id is profiles.id (NOT auth.users.id) since memberships.user_id references profiles.id
CREATE OR REPLACE FUNCTION public.has_valid_community_access(
  p_community_id UUID,
  p_profile_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_community RECORD;
  v_membership RECORD;
BEGIN
  -- Get community info
  SELECT pricing_type INTO v_community
  FROM public.communities
  WHERE id = p_community_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Free communities: just need membership
  IF v_community.pricing_type = 'free' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.memberships
      WHERE community_id = p_community_id AND user_id = p_profile_id
    );
  END IF;

  -- Paid communities: need membership with valid payment
  SELECT payment_status, expires_at INTO v_membership
  FROM public.memberships
  WHERE community_id = p_community_id AND user_id = p_profile_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check payment is valid
  IF v_membership.payment_status != 'paid' THEN
    RETURN false;
  END IF;

  -- Check not expired (null expires_at = lifetime access)
  IF v_membership.expires_at IS NOT NULL AND v_membership.expires_at < NOW() THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get community pricing details
CREATE OR REPLACE FUNCTION public.get_community_pricing(p_community_id UUID)
RETURNS TABLE (
  pricing_type public.community_pricing_type,
  price_cents INTEGER,
  currency TEXT,
  formatted_price TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.pricing_type,
    c.price_cents,
    c.currency,
    CASE
      WHEN c.pricing_type = 'free' THEN 'Free'
      ELSE CONCAT(
        CASE c.currency
          WHEN 'EUR' THEN chr(8364)  -- Euro symbol
          WHEN 'USD' THEN '$'
          WHEN 'GBP' THEN chr(163)   -- Pound symbol
          ELSE c.currency || ' '
        END,
        ROUND(c.price_cents / 100.0, 2)::TEXT,
        CASE c.pricing_type
          WHEN 'monthly' THEN '/month'
          ELSE ''
        END
      )
    END
  FROM public.communities c
  WHERE c.id = p_community_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
DECLARE
  v_communities_cols INTEGER;
  v_memberships_cols INTEGER;
  v_purchases_table BOOLEAN;
  v_policy_count INTEGER;
BEGIN
  -- Check communities columns added
  SELECT COUNT(*) INTO v_communities_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'communities'
    AND column_name IN ('pricing_type', 'price_cents', 'currency', 'stripe_product_id', 'stripe_price_id');

  -- Check memberships columns added
  SELECT COUNT(*) INTO v_memberships_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'memberships'
    AND column_name IN ('payment_status', 'stripe_subscription_id', 'stripe_payment_intent_id', 'paid_at', 'expires_at');

  -- Check purchases table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'community_purchases'
  ) INTO v_purchases_table;

  -- Count new policies
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'community_purchases';

  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Migration 013: Community Monetization COMPLETE';
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Communities columns added: %/5', v_communities_cols;
  RAISE NOTICE 'Memberships columns added: %/5', v_memberships_cols;
  RAISE NOTICE 'community_purchases table: %', CASE WHEN v_purchases_table THEN 'CREATED' ELSE 'FAILED' END;
  RAISE NOTICE 'RLS policies on purchases: %', v_policy_count;
  RAISE NOTICE 'Custom types: 1 (community_pricing_type)';
  RAISE NOTICE 'Helper functions: 2';
  RAISE NOTICE '';
  RAISE NOTICE 'Pricing Options:';
  RAISE NOTICE '  free      - No payment required';
  RAISE NOTICE '  one_time  - Single payment for lifetime access';
  RAISE NOTICE '  monthly   - Recurring subscription';
  RAISE NOTICE '';
  RAISE NOTICE 'Status: READY FOR COMMUNITY MONETIZATION';
  RAISE NOTICE '=================================================';
END $$;
