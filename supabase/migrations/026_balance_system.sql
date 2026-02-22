-- ============================================================================
-- CREATOR CLUB - BALANCE & PAYOUT SYSTEM SCHEMA
-- ============================================================================
-- Migration: 026_balance_system.sql
-- Created: 2026-01-15
-- Author: Architect Agent
--
-- This migration creates the wallet-style balance system for creators:
-- - Extends creator_billing with balance columns
-- - Creates pending_balances table (7-day hold tracking)
-- - Creates balance_transactions table (audit trail)
-- - Creates payouts table (payout history)
-- - Creates reserve_releases table (120-day rolling reserve)
--
-- Balance Model:
-- | Stage           | Duration | Description                              |
-- |-----------------|----------|------------------------------------------|
-- | Pending         | 7 days   | Funds held before becoming available     |
-- | Available       | -        | Ready for payout/withdrawal              |
-- | Reserved        | 120 days | Rolling reserve for chargeback protection|
-- | Negative        | -        | Debt from chargebacks                    |
--
-- Payout Rules:
-- - Weekly automatic payouts (Fridays)
-- - Minimum EUR 50
-- - Manual withdrawal with 72h cooldown
-- - Rolling reserve: 10% (new) / 0-5% (trusted)
-- ============================================================================

-- ============================================================================
-- SECTION 1: EXTEND creator_billing TABLE
-- ============================================================================
-- Add balance tracking columns to existing creator_billing table

ALTER TABLE public.creator_billing
  ADD COLUMN IF NOT EXISTS pending_balance_cents INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS available_balance_cents INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS reserved_balance_cents INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS negative_balance_cents INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS reserve_percent DECIMAL(5,2) DEFAULT 10.0 NOT NULL,
  ADD COLUMN IF NOT EXISTS trust_level TEXT DEFAULT 'new' NOT NULL,
  ADD COLUMN IF NOT EXISTS last_withdrawal_at TIMESTAMPTZ;

-- Add check constraints
ALTER TABLE public.creator_billing
  ADD CONSTRAINT creator_billing_trust_level_check
    CHECK (trust_level IN ('new', 'trusted')),
  ADD CONSTRAINT creator_billing_reserve_percent_check
    CHECK (reserve_percent >= 0 AND reserve_percent <= 100),
  ADD CONSTRAINT creator_billing_pending_balance_check
    CHECK (pending_balance_cents >= 0),
  ADD CONSTRAINT creator_billing_available_balance_check
    CHECK (available_balance_cents >= 0),
  ADD CONSTRAINT creator_billing_reserved_balance_check
    CHECK (reserved_balance_cents >= 0),
  ADD CONSTRAINT creator_billing_negative_balance_check
    CHECK (negative_balance_cents >= 0);

COMMENT ON COLUMN public.creator_billing.pending_balance_cents IS 'Funds in 7-day pending period (EUR cents)';
COMMENT ON COLUMN public.creator_billing.available_balance_cents IS 'Funds available for payout/withdrawal (EUR cents)';
COMMENT ON COLUMN public.creator_billing.reserved_balance_cents IS 'Rolling reserve held for chargeback protection (EUR cents)';
COMMENT ON COLUMN public.creator_billing.negative_balance_cents IS 'Debt from chargebacks that must be repaid (EUR cents)';
COMMENT ON COLUMN public.creator_billing.reserve_percent IS 'Current rolling reserve percentage (10 for new, 0-5 for trusted)';
COMMENT ON COLUMN public.creator_billing.trust_level IS 'Creator trust level: new (10% reserve) or trusted (reduced reserve)';
COMMENT ON COLUMN public.creator_billing.last_withdrawal_at IS 'Timestamp of last manual withdrawal (72h cooldown)';

-- ============================================================================
-- SECTION 2: CREATE pending_balances TABLE
-- ============================================================================
-- Tracks each sale during its 7-day pending period

CREATE TABLE public.pending_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.creator_sales(id) ON DELETE SET NULL,

  -- Amounts breakdown (all in EUR cents)
  gross_amount_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL,
  stripe_fee_cents INTEGER NOT NULL DEFAULT 0,
  reserve_amount_cents INTEGER NOT NULL,
  net_amount_cents INTEGER NOT NULL,

  -- Timing
  available_at TIMESTAMPTZ NOT NULL,

  -- Status
  status TEXT DEFAULT 'pending' NOT NULL,

  -- Stripe references
  stripe_payment_id TEXT,
  stripe_checkout_session_id TEXT,

  -- Product info
  product_type TEXT,
  product_name TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  released_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT pending_balances_status_check
    CHECK (status IN ('pending', 'released', 'cancelled')),
  CONSTRAINT pending_balances_amounts_positive
    CHECK (gross_amount_cents >= 0 AND platform_fee_cents >= 0 AND
           stripe_fee_cents >= 0 AND reserve_amount_cents >= 0 AND net_amount_cents >= 0)
);

-- Indexes
CREATE INDEX pending_balances_creator_status_idx
  ON public.pending_balances(creator_id, status);
CREATE INDEX pending_balances_available_at_status_idx
  ON public.pending_balances(available_at, status)
  WHERE status = 'pending';
CREATE INDEX pending_balances_sale_id_idx
  ON public.pending_balances(sale_id);
CREATE INDEX pending_balances_stripe_payment_idx
  ON public.pending_balances(stripe_payment_id);

COMMENT ON TABLE public.pending_balances IS 'Tracks sales during 7-day pending period before funds become available';
COMMENT ON COLUMN public.pending_balances.net_amount_cents IS 'Amount that becomes available after 7 days (gross - platform_fee - stripe_fee - reserve)';
COMMENT ON COLUMN public.pending_balances.available_at IS 'When funds become available (created_at + 7 days)';

-- ============================================================================
-- SECTION 3: CREATE balance_transactions TABLE
-- ============================================================================
-- Immutable audit trail of all balance changes

CREATE TABLE public.balance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Transaction type
  type TEXT NOT NULL,

  -- Amount (positive = credit, negative = debit)
  amount_cents INTEGER NOT NULL,

  -- Balance snapshots after this transaction
  pending_after_cents INTEGER NOT NULL,
  available_after_cents INTEGER NOT NULL,
  reserved_after_cents INTEGER NOT NULL,
  negative_after_cents INTEGER NOT NULL,

  -- References
  reference_type TEXT,
  reference_id TEXT,
  stripe_id TEXT,

  -- Details
  description TEXT,
  metadata JSONB DEFAULT '{}' NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT balance_transactions_type_check
    CHECK (type IN (
      'sale_pending',           -- New sale added to pending
      'pending_released',       -- Pending moved to available (7 days)
      'platform_fee_deducted',  -- Platform fee recorded
      'reserve_hold',           -- Funds moved to rolling reserve
      'reserve_release',        -- Reserve released (120 days)
      'payout',                 -- Automatic weekly payout
      'withdrawal',             -- Manual withdrawal
      'chargeback',             -- Dispute deducted
      'chargeback_reversal',    -- Won dispute credited back
      'adjustment'              -- Manual admin adjustment
    )),
  CONSTRAINT balance_transactions_snapshots_positive
    CHECK (pending_after_cents >= 0 AND available_after_cents >= 0 AND
           reserved_after_cents >= 0 AND negative_after_cents >= 0)
);

-- Indexes
CREATE INDEX balance_transactions_creator_created_idx
  ON public.balance_transactions(creator_id, created_at DESC);
CREATE INDEX balance_transactions_type_created_idx
  ON public.balance_transactions(type, created_at);
CREATE INDEX balance_transactions_reference_idx
  ON public.balance_transactions(reference_type, reference_id);
CREATE INDEX balance_transactions_stripe_id_idx
  ON public.balance_transactions(stripe_id)
  WHERE stripe_id IS NOT NULL;

COMMENT ON TABLE public.balance_transactions IS 'Immutable audit trail of all balance changes for creators';
COMMENT ON COLUMN public.balance_transactions.amount_cents IS 'Positive for credits, negative for debits';
COMMENT ON COLUMN public.balance_transactions.pending_after_cents IS 'Pending balance after this transaction';
COMMENT ON COLUMN public.balance_transactions.available_after_cents IS 'Available balance after this transaction';

-- ============================================================================
-- SECTION 4: CREATE payouts TABLE
-- ============================================================================
-- History of all payouts to creators

CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Payout details
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'EUR' NOT NULL,

  -- Type
  type TEXT DEFAULT 'automatic' NOT NULL,

  -- Status
  status TEXT DEFAULT 'pending' NOT NULL,

  -- Stripe references
  stripe_transfer_id TEXT,
  stripe_payout_id TEXT,

  -- Error handling
  failure_code TEXT,
  failure_message TEXT,
  retry_count INTEGER DEFAULT 0 NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  processing_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT payouts_type_check
    CHECK (type IN ('automatic', 'manual')),
  CONSTRAINT payouts_status_check
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  CONSTRAINT payouts_amount_positive
    CHECK (amount_cents > 0),
  CONSTRAINT payouts_retry_count_positive
    CHECK (retry_count >= 0)
);

-- Indexes
CREATE INDEX payouts_creator_created_idx
  ON public.payouts(creator_id, created_at DESC);
CREATE INDEX payouts_status_created_idx
  ON public.payouts(status, created_at)
  WHERE status IN ('pending', 'processing');
CREATE INDEX payouts_stripe_transfer_idx
  ON public.payouts(stripe_transfer_id)
  WHERE stripe_transfer_id IS NOT NULL;

COMMENT ON TABLE public.payouts IS 'History of all payouts to creators via Stripe Connect';
COMMENT ON COLUMN public.payouts.type IS 'automatic = weekly Friday payout, manual = creator-requested withdrawal';
COMMENT ON COLUMN public.payouts.status IS 'pending -> processing -> completed/failed';

-- ============================================================================
-- SECTION 5: CREATE reserve_releases TABLE
-- ============================================================================
-- Tracks rolling reserve entries for 120-day release

CREATE TABLE public.reserve_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pending_balance_id UUID REFERENCES public.pending_balances(id) ON DELETE SET NULL,

  amount_cents INTEGER NOT NULL,
  release_at TIMESTAMPTZ NOT NULL,

  status TEXT DEFAULT 'held' NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  released_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  used_for_dispute_id TEXT,

  -- Constraints
  CONSTRAINT reserve_releases_status_check
    CHECK (status IN ('held', 'released', 'used')),
  CONSTRAINT reserve_releases_amount_positive
    CHECK (amount_cents > 0)
);

-- Indexes
CREATE INDEX reserve_releases_creator_status_idx
  ON public.reserve_releases(creator_id, status);
CREATE INDEX reserve_releases_release_at_status_idx
  ON public.reserve_releases(release_at, status)
  WHERE status = 'held';

COMMENT ON TABLE public.reserve_releases IS 'Tracks rolling reserve entries for 120-day release schedule';
COMMENT ON COLUMN public.reserve_releases.release_at IS 'When reserve can be released (created_at + 120 days)';
COMMENT ON COLUMN public.reserve_releases.used_for_dispute_id IS 'Stripe dispute ID if reserve was used for chargeback';

-- ============================================================================
-- SECTION 6: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.pending_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_releases ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 7: ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RLS: pending_balances
-- Creators can view their own, service_role for modifications
-- ----------------------------------------------------------------------------

CREATE POLICY "Creators can view own pending balances"
  ON public.pending_balances FOR SELECT
  USING (creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service role manages pending balances"
  ON public.pending_balances FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Superadmins can view all pending balances"
  ON public.pending_balances FOR SELECT
  USING ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'superadmin');

-- ----------------------------------------------------------------------------
-- RLS: balance_transactions
-- Creators can view their own, service_role for inserts only (immutable)
-- ----------------------------------------------------------------------------

CREATE POLICY "Creators can view own balance transactions"
  ON public.balance_transactions FOR SELECT
  USING (creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service role inserts balance transactions"
  ON public.balance_transactions FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Superadmins can view all balance transactions"
  ON public.balance_transactions FOR SELECT
  USING ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'superadmin');

-- Prevent updates and deletes (transactions are immutable)
-- No UPDATE or DELETE policies created - only INSERT and SELECT

-- ----------------------------------------------------------------------------
-- RLS: payouts
-- Creators can view their own, service_role for modifications
-- ----------------------------------------------------------------------------

CREATE POLICY "Creators can view own payouts"
  ON public.payouts FOR SELECT
  USING (creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service role manages payouts"
  ON public.payouts FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Superadmins can view all payouts"
  ON public.payouts FOR SELECT
  USING ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'superadmin');

-- ----------------------------------------------------------------------------
-- RLS: reserve_releases
-- Creators can view their own, service_role for modifications
-- ----------------------------------------------------------------------------

CREATE POLICY "Creators can view own reserves"
  ON public.reserve_releases FOR SELECT
  USING (creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service role manages reserves"
  ON public.reserve_releases FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Superadmins can view all reserves"
  ON public.reserve_releases FOR SELECT
  USING ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'superadmin');

-- ============================================================================
-- SECTION 8: PROTECT BALANCE FIELDS IN creator_billing
-- ============================================================================
-- Extend the existing protection trigger to include balance fields

CREATE OR REPLACE FUNCTION public.protect_billing_critical_fields()
RETURNS TRIGGER AS $$
DECLARE
  v_current_role TEXT;
  v_is_privileged BOOLEAN := false;
BEGIN
  -- Get the current database role
  BEGIN
    v_current_role := current_setting('role', true);
  EXCEPTION WHEN OTHERS THEN
    v_current_role := 'unknown';
  END;

  -- Check if running as privileged role
  IF v_current_role IN ('service_role', 'supabase_admin', 'postgres') THEN
    v_is_privileged := true;
  END IF;

  -- Also check JWT role claim for service_role
  BEGIN
    IF auth.jwt() ->> 'role' = 'service_role' THEN
      v_is_privileged := true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- If not privileged, check for protected field changes
  IF NOT v_is_privileged THEN
    -- Original protected fields
    IF OLD.has_first_sale IS DISTINCT FROM NEW.has_first_sale THEN
      RAISE EXCEPTION 'Cannot modify protected field: has_first_sale';
    END IF;
    IF OLD.first_sale_at IS DISTINCT FROM NEW.first_sale_at THEN
      RAISE EXCEPTION 'Cannot modify protected field: first_sale_at';
    END IF;
    IF OLD.monthly_fee_active IS DISTINCT FROM NEW.monthly_fee_active THEN
      RAISE EXCEPTION 'Cannot modify protected field: monthly_fee_active';
    END IF;
    IF OLD.activation_fee_paid IS DISTINCT FROM NEW.activation_fee_paid THEN
      RAISE EXCEPTION 'Cannot modify protected field: activation_fee_paid';
    END IF;
    IF OLD.activation_fee_paid_at IS DISTINCT FROM NEW.activation_fee_paid_at THEN
      RAISE EXCEPTION 'Cannot modify protected field: activation_fee_paid_at';
    END IF;
    IF OLD.stripe_customer_id IS DISTINCT FROM NEW.stripe_customer_id THEN
      RAISE EXCEPTION 'Cannot modify protected field: stripe_customer_id';
    END IF;
    IF OLD.stripe_subscription_id IS DISTINCT FROM NEW.stripe_subscription_id THEN
      RAISE EXCEPTION 'Cannot modify protected field: stripe_subscription_id';
    END IF;
    IF OLD.stripe_account_id IS DISTINCT FROM NEW.stripe_account_id THEN
      RAISE EXCEPTION 'Cannot modify protected field: stripe_account_id';
    END IF;

    -- NEW: Balance fields (all protected from client modification)
    IF OLD.pending_balance_cents IS DISTINCT FROM NEW.pending_balance_cents THEN
      RAISE EXCEPTION 'Cannot modify protected field: pending_balance_cents';
    END IF;
    IF OLD.available_balance_cents IS DISTINCT FROM NEW.available_balance_cents THEN
      RAISE EXCEPTION 'Cannot modify protected field: available_balance_cents';
    END IF;
    IF OLD.reserved_balance_cents IS DISTINCT FROM NEW.reserved_balance_cents THEN
      RAISE EXCEPTION 'Cannot modify protected field: reserved_balance_cents';
    END IF;
    IF OLD.negative_balance_cents IS DISTINCT FROM NEW.negative_balance_cents THEN
      RAISE EXCEPTION 'Cannot modify protected field: negative_balance_cents';
    END IF;
    IF OLD.reserve_percent IS DISTINCT FROM NEW.reserve_percent THEN
      RAISE EXCEPTION 'Cannot modify protected field: reserve_percent';
    END IF;
    IF OLD.trust_level IS DISTINCT FROM NEW.trust_level THEN
      RAISE EXCEPTION 'Cannot modify protected field: trust_level';
    END IF;
    IF OLD.last_withdrawal_at IS DISTINCT FROM NEW.last_withdrawal_at THEN
      RAISE EXCEPTION 'Cannot modify protected field: last_withdrawal_at';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 9: GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON public.pending_balances TO authenticated;
GRANT SELECT ON public.balance_transactions TO authenticated;
GRANT SELECT ON public.payouts TO authenticated;
GRANT SELECT ON public.reserve_releases TO authenticated;

-- ============================================================================
-- SECTION 10: HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate payout amount (considering negative balance)
CREATE OR REPLACE FUNCTION public.calculate_creator_payout_amount(p_creator_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_available INTEGER;
  v_negative INTEGER;
BEGIN
  SELECT available_balance_cents, negative_balance_cents
  INTO v_available, v_negative
  FROM public.creator_billing
  WHERE creator_id = p_creator_id;

  IF v_available IS NULL THEN
    RETURN 0;
  END IF;

  -- Negative balance must be cleared first
  IF v_negative > 0 THEN
    RETURN GREATEST(0, v_available - v_negative);
  END IF;

  RETURN v_available;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.calculate_creator_payout_amount(UUID) IS
'Calculates available payout amount after deducting any negative balance';

-- Function to check if creator can withdraw
CREATE OR REPLACE FUNCTION public.can_creator_withdraw(p_creator_id UUID)
RETURNS JSON AS $$
DECLARE
  v_billing public.creator_billing%ROWTYPE;
  v_payout_amount INTEGER;
  v_cooldown_end TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_billing
  FROM public.creator_billing
  WHERE creator_id = p_creator_id;

  IF v_billing IS NULL THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'BILLING_NOT_FOUND',
      'message', 'Billing record not found'
    );
  END IF;

  -- Check Connect status
  IF v_billing.stripe_account_status IS NULL OR v_billing.stripe_account_status != 'active' THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'CONNECT_NOT_ACTIVE',
      'message', 'Please complete Stripe Connect setup to receive payouts'
    );
  END IF;

  -- Check cooldown (72 hours)
  IF v_billing.last_withdrawal_at IS NOT NULL THEN
    v_cooldown_end := v_billing.last_withdrawal_at + INTERVAL '72 hours';
    IF v_cooldown_end > NOW() THEN
      RETURN json_build_object(
        'allowed', false,
        'reason', 'COOLDOWN_ACTIVE',
        'message', 'Please wait 72 hours between withdrawals',
        'cooldown_ends_at', v_cooldown_end,
        'hours_remaining', EXTRACT(EPOCH FROM (v_cooldown_end - NOW())) / 3600
      );
    END IF;
  END IF;

  -- Calculate payout amount (after negative balance)
  v_payout_amount := public.calculate_creator_payout_amount(p_creator_id);

  -- Check minimum (EUR 50 = 5000 cents)
  IF v_payout_amount < 5000 THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'BELOW_MINIMUM',
      'message', 'Minimum withdrawal is EUR 50',
      'available_cents', v_payout_amount,
      'minimum_cents', 5000,
      'shortfall_cents', 5000 - v_payout_amount
    );
  END IF;

  -- All checks passed
  RETURN json_build_object(
    'allowed', true,
    'amount_cents', v_payout_amount,
    'message', 'Withdrawal available'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.can_creator_withdraw(UUID) IS
'Checks if creator can make a manual withdrawal (Connect active, cooldown passed, minimum met)';

GRANT EXECUTE ON FUNCTION public.calculate_creator_payout_amount(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_creator_withdraw(UUID) TO authenticated;

-- Function to get creator balance summary
CREATE OR REPLACE FUNCTION public.get_creator_balance_summary(p_creator_id UUID)
RETURNS JSON AS $$
DECLARE
  v_billing public.creator_billing%ROWTYPE;
  v_pending_count INTEGER;
  v_next_release TIMESTAMPTZ;
  v_can_withdraw JSON;
BEGIN
  -- Authorization check
  IF (SELECT id FROM public.profiles WHERE user_id = auth.uid()) != p_creator_id
     AND (auth.jwt() ->> 'role') != 'service_role'
     AND COALESCE((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role', '') != 'superadmin' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Not authorized',
      'code', 'UNAUTHORIZED'
    );
  END IF;

  SELECT * INTO v_billing
  FROM public.creator_billing
  WHERE creator_id = p_creator_id;

  IF v_billing IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Billing record not found',
      'code', 'NOT_FOUND'
    );
  END IF;

  -- Count pending entries
  SELECT COUNT(*) INTO v_pending_count
  FROM public.pending_balances
  WHERE creator_id = p_creator_id AND status = 'pending';

  -- Get next pending release date
  SELECT MIN(available_at) INTO v_next_release
  FROM public.pending_balances
  WHERE creator_id = p_creator_id AND status = 'pending';

  -- Check withdrawal eligibility
  v_can_withdraw := public.can_creator_withdraw(p_creator_id);

  RETURN json_build_object(
    'success', true,
    'balances', json_build_object(
      'pending_cents', v_billing.pending_balance_cents,
      'available_cents', v_billing.available_balance_cents,
      'reserved_cents', v_billing.reserved_balance_cents,
      'negative_cents', v_billing.negative_balance_cents,
      'total_cents', v_billing.pending_balance_cents + v_billing.available_balance_cents
    ),
    'trust_level', v_billing.trust_level,
    'reserve_percent', v_billing.reserve_percent,
    'pending_entries_count', v_pending_count,
    'next_pending_release', v_next_release,
    'last_withdrawal_at', v_billing.last_withdrawal_at,
    'withdrawal', v_can_withdraw,
    'connect_status', v_billing.stripe_account_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_creator_balance_summary(UUID) IS
'Returns complete balance summary for a creator including withdrawal eligibility';

GRANT EXECUTE ON FUNCTION public.get_creator_balance_summary(UUID) TO authenticated;

-- ============================================================================
-- SECTION 11: INITIALIZE EXISTING CREATORS
-- ============================================================================
-- Set initial balances to 0 for any existing creator_billing records

UPDATE public.creator_billing
SET
  pending_balance_cents = COALESCE(pending_balance_cents, 0),
  available_balance_cents = COALESCE(available_balance_cents, 0),
  reserved_balance_cents = COALESCE(reserved_balance_cents, 0),
  negative_balance_cents = COALESCE(negative_balance_cents, 0),
  reserve_percent = COALESCE(reserve_percent, 10.0),
  trust_level = COALESCE(trust_level, 'new')
WHERE pending_balance_cents IS NULL
   OR available_balance_cents IS NULL
   OR reserved_balance_cents IS NULL
   OR negative_balance_cents IS NULL;

-- ============================================================================
-- MIGRATION COMPLETE - VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_table_count INTEGER;
  v_column_count INTEGER;
  v_policy_count INTEGER;
  v_function_count INTEGER;
BEGIN
  -- Count new tables
  SELECT COUNT(*) INTO v_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('pending_balances', 'balance_transactions', 'payouts', 'reserve_releases');

  -- Count new columns on creator_billing
  SELECT COUNT(*) INTO v_column_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'creator_billing'
    AND column_name IN ('pending_balance_cents', 'available_balance_cents',
                        'reserved_balance_cents', 'negative_balance_cents',
                        'reserve_percent', 'trust_level', 'last_withdrawal_at');

  -- Count RLS policies on new tables
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('pending_balances', 'balance_transactions', 'payouts', 'reserve_releases');

  -- Count new functions
  SELECT COUNT(*) INTO v_function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname IN ('calculate_creator_payout_amount', 'can_creator_withdraw', 'get_creator_balance_summary');

  RAISE NOTICE '================================================';
  RAISE NOTICE 'Migration 026: Balance System Schema COMPLETE';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'New Tables: %', v_table_count;
  RAISE NOTICE '  - pending_balances (7-day tracking)';
  RAISE NOTICE '  - balance_transactions (audit trail)';
  RAISE NOTICE '  - payouts (payout history)';
  RAISE NOTICE '  - reserve_releases (120-day reserve)';
  RAISE NOTICE '';
  RAISE NOTICE 'New Columns on creator_billing: %', v_column_count;
  RAISE NOTICE '  - pending_balance_cents';
  RAISE NOTICE '  - available_balance_cents';
  RAISE NOTICE '  - reserved_balance_cents';
  RAISE NOTICE '  - negative_balance_cents';
  RAISE NOTICE '  - reserve_percent';
  RAISE NOTICE '  - trust_level';
  RAISE NOTICE '  - last_withdrawal_at';
  RAISE NOTICE '';
  RAISE NOTICE 'RLS Policies: %', v_policy_count;
  RAISE NOTICE '  - Creators can view own data';
  RAISE NOTICE '  - Service role for all modifications';
  RAISE NOTICE '  - Superadmins can view all';
  RAISE NOTICE '';
  RAISE NOTICE 'Helper Functions: %', v_function_count;
  RAISE NOTICE '  - calculate_creator_payout_amount()';
  RAISE NOTICE '  - can_creator_withdraw()';
  RAISE NOTICE '  - get_creator_balance_summary()';
  RAISE NOTICE '';
  RAISE NOTICE 'Balance Model:';
  RAISE NOTICE '  - Pending: 7 days hold';
  RAISE NOTICE '  - Available: Ready for payout';
  RAISE NOTICE '  - Reserved: 120 days rolling';
  RAISE NOTICE '  - Negative: Chargeback debt';
  RAISE NOTICE '';
  RAISE NOTICE 'Payout Rules:';
  RAISE NOTICE '  - Weekly automatic (Fridays)';
  RAISE NOTICE '  - Minimum EUR 50';
  RAISE NOTICE '  - Manual: 72h cooldown';
  RAISE NOTICE '  - Reserve: 10%% (new), 0-5%% (trusted)';
  RAISE NOTICE '';
  RAISE NOTICE 'Status: READY FOR IMPLEMENTATION';
  RAISE NOTICE '================================================';
END $$;
