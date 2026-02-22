-- ============================================================================
-- CREATOR CLUB - DUAL PRICING (ONE-TIME + MONTHLY)
-- ============================================================================
-- Migration: 020_dual_pricing.sql
-- Created: 2026-02-13
--
-- Allows creators to offer BOTH one-time and monthly pricing simultaneously.
-- Students choose at checkout which option they prefer.
--
-- Changes:
-- 1. Add 'both' to community_pricing_type enum
-- 2. Add monthly_price_cents column for the monthly price
-- 3. Add stripe_monthly_price_id for the recurring Stripe Price
-- 4. Update paid_community_has_price constraint
-- ============================================================================

-- Add 'both' to the pricing type enum
ALTER TYPE public.community_pricing_type ADD VALUE IF NOT EXISTS 'both';

-- Add monthly pricing columns
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS monthly_price_cents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_monthly_price_id TEXT;

-- Update constraint: 'both' requires both prices > 0
ALTER TABLE public.communities DROP CONSTRAINT IF EXISTS paid_community_has_price;
ALTER TABLE public.communities ADD CONSTRAINT paid_community_has_price CHECK (
  (pricing_type = 'free' AND price_cents = 0) OR
  (pricing_type IN ('one_time', 'monthly') AND price_cents > 0) OR
  (pricing_type = 'both' AND price_cents > 0 AND monthly_price_cents > 0)
);

-- Add constraint for monthly price validation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_monthly_price' AND conrelid = 'public.communities'::regclass
  ) THEN
    ALTER TABLE public.communities
    ADD CONSTRAINT valid_monthly_price CHECK (monthly_price_cents >= 0);
  END IF;
END$$;

COMMENT ON COLUMN public.communities.monthly_price_cents IS 'Monthly subscription price in cents. Used when pricing_type is both.';
COMMENT ON COLUMN public.communities.stripe_monthly_price_id IS 'Stripe Price ID for recurring monthly billing. Used when pricing_type is both.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
DECLARE
  v_has_monthly_price BOOLEAN;
  v_has_stripe_monthly BOOLEAN;
  v_enum_has_both BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'communities' AND column_name = 'monthly_price_cents'
  ) INTO v_has_monthly_price;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'communities' AND column_name = 'stripe_monthly_price_id'
  ) INTO v_has_stripe_monthly;

  SELECT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'community_pricing_type' AND e.enumlabel = 'both'
  ) INTO v_enum_has_both;

  RAISE NOTICE '=== Migration 020: Dual Pricing ===';
  RAISE NOTICE 'monthly_price_cents column: %', CASE WHEN v_has_monthly_price THEN 'OK' ELSE 'MISSING' END;
  RAISE NOTICE 'stripe_monthly_price_id column: %', CASE WHEN v_has_stripe_monthly THEN 'OK' ELSE 'MISSING' END;
  RAISE NOTICE 'enum has both: %', CASE WHEN v_enum_has_both THEN 'OK' ELSE 'MISSING' END;
END $$;
