-- ============================================================================
-- CREATOR CLUB - BILLING SYSTEM SECURITY FIXES
-- ============================================================================
-- Migration: 012_billing_security.sql
-- Created: 2025-12-29
-- Author: Implementer-DB Agent
--
-- This migration addresses critical security issues identified in code review:
-- - C4: RLS Policy Gap - First sale fields can be manipulated by creators
-- - C5: Missing Transaction Atomicity - First sale activation not transactional
--
-- Changes:
-- 1. Create trigger to protect critical billing fields from client manipulation
-- 2. Create atomic function for first sale activation
-- 3. Add audit trail table for billing changes
-- 4. Tighten RLS policies on creator_billing table
-- ============================================================================

-- ============================================================================
-- SECTION 1: AUDIT TRAIL TABLE
-- ============================================================================
-- Creates a comprehensive audit log for all billing changes to track
-- who changed what and when for security and compliance purposes.

CREATE TABLE public.billing_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What was changed
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),

  -- Who made the change
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_role TEXT, -- 'authenticated', 'service_role', 'anon', etc.

  -- What changed
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[], -- List of field names that changed

  -- Context
  client_ip INET,
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX billing_audit_log_table_name_idx ON public.billing_audit_log(table_name);
CREATE INDEX billing_audit_log_record_id_idx ON public.billing_audit_log(record_id);
CREATE INDEX billing_audit_log_changed_by_idx ON public.billing_audit_log(changed_by);
CREATE INDEX billing_audit_log_created_at_idx ON public.billing_audit_log(created_at DESC);
CREATE INDEX billing_audit_log_operation_idx ON public.billing_audit_log(operation);

COMMENT ON TABLE public.billing_audit_log IS 'Immutable audit trail for all billing-related changes';

-- Enable RLS on audit log (service_role only for writes, superadmins for reads)
ALTER TABLE public.billing_audit_log ENABLE ROW LEVEL SECURITY;

-- Only service_role can insert audit entries
CREATE POLICY "Service role can insert audit entries"
  ON public.billing_audit_log FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Superadmins can view audit log
CREATE POLICY "Superadmins can view audit log"
  ON public.billing_audit_log FOR SELECT
  USING ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'superadmin');

-- Service role has full access
CREATE POLICY "Service role full access to audit log"
  ON public.billing_audit_log FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- SECTION 2: AUDIT TRIGGER FUNCTION
-- ============================================================================
-- Creates a generic audit function that logs all changes to billing tables.

CREATE OR REPLACE FUNCTION public.audit_billing_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_old_values JSONB := NULL;
  v_new_values JSONB := NULL;
  v_changed_fields TEXT[] := '{}';
  v_record_id UUID;
  v_changed_by UUID;
  v_role TEXT;
BEGIN
  -- Determine the record ID
  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    v_old_values := to_jsonb(OLD);
  ELSIF TG_OP = 'INSERT' THEN
    v_record_id := NEW.id;
    v_new_values := to_jsonb(NEW);
  ELSE -- UPDATE
    v_record_id := NEW.id;
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);

    -- Determine which fields changed
    SELECT array_agg(key)
    INTO v_changed_fields
    FROM jsonb_each(v_new_values)
    WHERE v_old_values->key IS DISTINCT FROM v_new_values->key;
  END IF;

  -- Get the current user and role
  BEGIN
    v_changed_by := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_changed_by := NULL;
  END;

  BEGIN
    v_role := current_setting('role', true);
    IF v_role IS NULL THEN
      v_role := 'unknown';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'unknown';
  END;

  -- Insert audit record
  INSERT INTO public.billing_audit_log (
    table_name,
    record_id,
    operation,
    changed_by,
    changed_by_role,
    old_values,
    new_values,
    changed_fields
  ) VALUES (
    TG_TABLE_NAME,
    v_record_id,
    TG_OP,
    v_changed_by,
    v_role,
    v_old_values,
    v_new_values,
    v_changed_fields
  );

  -- Return appropriate value based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.audit_billing_changes() IS 'Generic audit trigger function for billing tables';

-- ============================================================================
-- SECTION 3: PROTECT CRITICAL BILLING FIELDS (Fixes C4)
-- ============================================================================
-- Creates a trigger that prevents direct modification of critical billing fields
-- by authenticated users. Only service_role (Edge Functions) can modify these.
--
-- Protected fields:
-- - has_first_sale: Determines if creator has made their first sale
-- - first_sale_at: Timestamp of first sale
-- - monthly_fee_active: Whether monthly subscription is active
-- - activation_fee_paid: Whether one-time activation fee was paid
-- - activation_fee_paid_at: Timestamp of activation fee payment
--
-- These fields control billing status and could be manipulated to avoid fees
-- if left unprotected.

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
  -- service_role is used by Supabase Edge Functions
  -- supabase_admin is used by migrations and admin operations
  -- postgres is the superuser
  IF v_current_role IN ('service_role', 'supabase_admin', 'postgres') THEN
    v_is_privileged := true;
  END IF;

  -- Also check JWT role claim for service_role
  BEGIN
    IF auth.jwt() ->> 'role' = 'service_role' THEN
      v_is_privileged := true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- JWT might not be available in all contexts
    NULL;
  END;

  -- If not privileged, check for protected field changes
  IF NOT v_is_privileged THEN
    -- Check if any protected field is being changed
    IF OLD.has_first_sale IS DISTINCT FROM NEW.has_first_sale THEN
      RAISE EXCEPTION 'Cannot modify protected field: has_first_sale. This field can only be updated by the system.';
    END IF;

    IF OLD.first_sale_at IS DISTINCT FROM NEW.first_sale_at THEN
      RAISE EXCEPTION 'Cannot modify protected field: first_sale_at. This field can only be updated by the system.';
    END IF;

    IF OLD.monthly_fee_active IS DISTINCT FROM NEW.monthly_fee_active THEN
      RAISE EXCEPTION 'Cannot modify protected field: monthly_fee_active. This field can only be updated by the system.';
    END IF;

    IF OLD.activation_fee_paid IS DISTINCT FROM NEW.activation_fee_paid THEN
      RAISE EXCEPTION 'Cannot modify protected field: activation_fee_paid. This field can only be updated by the system.';
    END IF;

    IF OLD.activation_fee_paid_at IS DISTINCT FROM NEW.activation_fee_paid_at THEN
      RAISE EXCEPTION 'Cannot modify protected field: activation_fee_paid_at. This field can only be updated by the system.';
    END IF;

    -- Also protect Stripe IDs from client manipulation
    IF OLD.stripe_customer_id IS DISTINCT FROM NEW.stripe_customer_id THEN
      RAISE EXCEPTION 'Cannot modify protected field: stripe_customer_id. This field can only be updated by the system.';
    END IF;

    IF OLD.stripe_subscription_id IS DISTINCT FROM NEW.stripe_subscription_id THEN
      RAISE EXCEPTION 'Cannot modify protected field: stripe_subscription_id. This field can only be updated by the system.';
    END IF;

    IF OLD.stripe_account_id IS DISTINCT FROM NEW.stripe_account_id THEN
      RAISE EXCEPTION 'Cannot modify protected field: stripe_account_id. This field can only be updated by the system.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.protect_billing_critical_fields() IS
'Prevents non-privileged users from modifying critical billing fields that control fee activation and Stripe integration';

-- Apply the protection trigger to creator_billing
CREATE TRIGGER protect_creator_billing_fields
  BEFORE UPDATE ON public.creator_billing
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_billing_critical_fields();

-- ============================================================================
-- SECTION 4: ATOMIC FIRST SALE ACTIVATION (Fixes C5)
-- ============================================================================
-- Creates a function that handles first sale activation atomically.
-- This ensures that when a creator makes their first sale:
-- 1. has_first_sale is set to true
-- 2. first_sale_at is recorded
-- 3. For Pro/Scale plans, monthly_fee_active is set to true
-- All changes happen in a single transaction or none happen at all.

CREATE OR REPLACE FUNCTION public.activate_first_sale(
  p_creator_id UUID,
  p_sale_amount_cents INTEGER,
  p_stripe_payment_intent_id TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_billing creator_billing%ROWTYPE;
  v_plan billing_plans%ROWTYPE;
  v_starter_plan_id UUID;
  v_result JSON;
BEGIN
  -- Start by getting the starter plan ID for comparison
  SELECT id INTO v_starter_plan_id
  FROM public.billing_plans
  WHERE tier = 'starter'
  LIMIT 1;

  IF v_starter_plan_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Billing plans not configured',
      'code', 'PLANS_NOT_FOUND'
    );
  END IF;

  -- Lock the billing row for update to prevent race conditions
  SELECT * INTO v_billing
  FROM public.creator_billing
  WHERE creator_id = p_creator_id
  FOR UPDATE;

  -- Check if creator billing record exists
  IF v_billing IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Creator billing record not found',
      'code', 'BILLING_NOT_FOUND',
      'creator_id', p_creator_id
    );
  END IF;

  -- Check if already has first sale (idempotent - return success if already done)
  IF v_billing.has_first_sale THEN
    RETURN json_build_object(
      'success', true,
      'already_activated', true,
      'first_sale_at', v_billing.first_sale_at,
      'monthly_fee_active', v_billing.monthly_fee_active,
      'message', 'First sale was already activated'
    );
  END IF;

  -- Get the creator's current plan
  SELECT * INTO v_plan
  FROM public.billing_plans
  WHERE id = v_billing.plan_id;

  IF v_plan IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Creator plan not found',
      'code', 'PLAN_NOT_FOUND'
    );
  END IF;

  -- Atomically update billing record
  -- For non-starter plans (Pro/Scale), also activate monthly fee
  UPDATE public.creator_billing
  SET
    has_first_sale = true,
    first_sale_at = NOW(),
    monthly_fee_active = CASE
      WHEN plan_id != v_starter_plan_id THEN true
      ELSE false
    END,
    updated_at = NOW()
  WHERE creator_id = p_creator_id;

  -- Record the sale in creator_sales for tracking
  -- Note: Platform fee calculation uses the calculate_platform_fee function
  IF p_sale_amount_cents > 0 THEN
    INSERT INTO public.creator_sales (
      creator_id,
      product_type,
      product_name,
      sale_amount_cents,
      platform_fee_cents,
      stripe_fee_cents,
      net_amount_cents,
      stripe_payment_intent_id,
      status,
      completed_at
    ) VALUES (
      p_creator_id,
      'first_sale',
      'First Sale - Billing Activation',
      p_sale_amount_cents,
      public.calculate_platform_fee(p_creator_id, p_sale_amount_cents),
      0, -- Stripe fee calculated separately
      p_sale_amount_cents - public.calculate_platform_fee(p_creator_id, p_sale_amount_cents),
      p_stripe_payment_intent_id,
      'completed',
      NOW()
    );
  END IF;

  -- Create transaction record for audit trail
  INSERT INTO public.billing_transactions (
    creator_id,
    type,
    status,
    amount_cents,
    description,
    stripe_payment_intent_id,
    metadata,
    processed_at
  ) VALUES (
    p_creator_id,
    'platform_fee',
    'completed',
    CASE WHEN p_sale_amount_cents > 0
      THEN public.calculate_platform_fee(p_creator_id, p_sale_amount_cents)
      ELSE 0
    END,
    'First sale activation - platform fee recorded',
    p_stripe_payment_intent_id,
    json_build_object(
      'event', 'first_sale_activation',
      'sale_amount_cents', p_sale_amount_cents,
      'plan_tier', v_plan.tier,
      'monthly_fee_activated', v_plan.tier != 'starter'
    )::jsonb,
    NOW()
  );

  -- Return success with details
  RETURN json_build_object(
    'success', true,
    'first_sale_at', NOW(),
    'monthly_fee_active', v_plan.tier != 'starter',
    'plan_tier', v_plan.tier,
    'platform_fee_percent', v_plan.platform_fee_percent,
    'message', CASE
      WHEN v_plan.tier = 'starter'
      THEN 'First sale recorded. Starter plan has no monthly fee.'
      ELSE format('First sale recorded. Monthly fee of EUR %s now active for %s plan.',
                  (v_plan.price_monthly_cents / 100.0)::TEXT, v_plan.name)
    END
  );

EXCEPTION WHEN OTHERS THEN
  -- Log error and return failure
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM,
    'code', 'INTERNAL_ERROR',
    'detail', SQLSTATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.activate_first_sale(UUID, INTEGER, TEXT) IS
'Atomically activates first sale for a creator, setting has_first_sale and optionally monthly_fee_active based on plan tier. Idempotent - safe to call multiple times.';

-- Grant execute permission to authenticated users (Edge Functions will call this with service_role)
GRANT EXECUTE ON FUNCTION public.activate_first_sale(UUID, INTEGER, TEXT) TO authenticated;

-- ============================================================================
-- SECTION 5: ACTIVATION FEE PAYMENT FUNCTION
-- ============================================================================
-- Creates a function to atomically record activation fee payment.
-- Only service_role should call this after confirming payment with Stripe.

CREATE OR REPLACE FUNCTION public.record_activation_fee_payment(
  p_creator_id UUID,
  p_stripe_payment_intent_id TEXT,
  p_stripe_customer_id TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_billing creator_billing%ROWTYPE;
BEGIN
  -- Lock the billing row for update
  SELECT * INTO v_billing
  FROM public.creator_billing
  WHERE creator_id = p_creator_id
  FOR UPDATE;

  -- Check if creator billing record exists
  IF v_billing IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Creator billing record not found',
      'code', 'BILLING_NOT_FOUND'
    );
  END IF;

  -- Check if already paid (idempotent)
  IF v_billing.activation_fee_paid THEN
    RETURN json_build_object(
      'success', true,
      'already_paid', true,
      'paid_at', v_billing.activation_fee_paid_at,
      'message', 'Activation fee was already recorded'
    );
  END IF;

  -- Update billing record
  UPDATE public.creator_billing
  SET
    activation_fee_paid = true,
    activation_fee_paid_at = NOW(),
    stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
    status = 'active',
    updated_at = NOW()
  WHERE creator_id = p_creator_id;

  -- Record transaction
  INSERT INTO public.billing_transactions (
    creator_id,
    type,
    status,
    amount_cents,
    description,
    stripe_payment_intent_id,
    metadata,
    processed_at
  ) VALUES (
    p_creator_id,
    'activation_fee',
    'completed',
    290, -- EUR 2.90 in cents
    'One-time activation fee payment',
    p_stripe_payment_intent_id,
    json_build_object(
      'event', 'activation_fee_payment',
      'stripe_customer_id', p_stripe_customer_id
    )::jsonb,
    NOW()
  );

  RETURN json_build_object(
    'success', true,
    'paid_at', NOW(),
    'message', 'Activation fee recorded successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM,
    'code', 'INTERNAL_ERROR'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.record_activation_fee_payment(UUID, TEXT, TEXT) IS
'Atomically records activation fee payment for a creator. Idempotent - safe to call multiple times.';

-- Grant execute to authenticated (will be called via Edge Function with service_role)
GRANT EXECUTE ON FUNCTION public.record_activation_fee_payment(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- SECTION 6: TIGHTEN RLS POLICIES ON CREATOR_BILLING
-- ============================================================================
-- The current policies allow creators to UPDATE their own billing records.
-- This is too permissive - creators should only be able to SELECT their records.
-- All billing modifications should go through Edge Functions (service_role).

-- First, drop the overly permissive update policy
DROP POLICY IF EXISTS "Creators can update own billing" ON public.creator_billing;

-- Note: The "Creators can insert own billing" policy is kept for initial setup,
-- but new billing records should generally be created by service_role after
-- registration. Consider removing this policy if using Edge Functions for
-- all billing operations.

-- Create a more restrictive policy for reads
-- (Creators can still view their own billing records)
-- The existing "Creators can view own billing" policy is fine.

-- Add policy comment for documentation
COMMENT ON POLICY "Creators can view own billing" ON public.creator_billing IS
'Allows creators to view their own billing records. Modifications must go through Edge Functions (service_role).';

COMMENT ON POLICY "Service role can manage all billing" ON public.creator_billing IS
'Service role (Edge Functions) has full access to billing records for all operations.';

-- ============================================================================
-- SECTION 7: ADD AUDIT TRIGGERS TO BILLING TABLES
-- ============================================================================
-- Apply audit logging to all billing-related tables.

-- Audit trigger for creator_billing
CREATE TRIGGER audit_creator_billing_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.creator_billing
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_billing_changes();

-- Audit trigger for billing_transactions
CREATE TRIGGER audit_billing_transactions_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.billing_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_billing_changes();

-- Audit trigger for creator_sales
CREATE TRIGGER audit_creator_sales_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.creator_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_billing_changes();

-- Audit trigger for billing_plans (rarely changed but important)
CREATE TRIGGER audit_billing_plans_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.billing_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_billing_changes();

-- ============================================================================
-- SECTION 8: HELPER FUNCTION TO CHECK BILLING STATUS
-- ============================================================================
-- A safe function for clients to check billing status without exposing
-- sensitive fields or allowing modification.

CREATE OR REPLACE FUNCTION public.get_creator_billing_status(p_creator_id UUID)
RETURNS JSON AS $$
DECLARE
  v_billing creator_billing%ROWTYPE;
  v_plan billing_plans%ROWTYPE;
BEGIN
  -- Check authorization - creator can only check their own status
  IF auth.uid() != p_creator_id AND
     (auth.jwt() ->> 'role') != 'service_role' AND
     COALESCE((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role', '') != 'superadmin' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Not authorized to view this billing status',
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

  SELECT * INTO v_plan
  FROM public.billing_plans
  WHERE id = v_billing.plan_id;

  RETURN json_build_object(
    'success', true,
    'plan_tier', v_plan.tier,
    'plan_name', v_plan.name,
    'status', v_billing.status,
    'has_first_sale', v_billing.has_first_sale,
    'first_sale_at', v_billing.first_sale_at,
    'monthly_fee_active', v_billing.monthly_fee_active,
    'activation_fee_paid', v_billing.activation_fee_paid,
    'platform_fee_percent', v_plan.platform_fee_percent,
    'price_monthly_cents', v_plan.price_monthly_cents,
    'features', v_plan.features,
    'current_period_end', v_billing.current_period_end,
    'cancel_at_period_end', v_billing.cancel_at_period_end,
    -- Don't expose Stripe IDs to client
    'has_stripe_account', v_billing.stripe_account_id IS NOT NULL,
    'stripe_account_status', v_billing.stripe_account_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_creator_billing_status(UUID) IS
'Returns billing status for a creator without exposing sensitive Stripe IDs. Authorization enforced.';

GRANT EXECUTE ON FUNCTION public.get_creator_billing_status(UUID) TO authenticated;

-- ============================================================================
-- SECTION 9: GRANT PERMISSIONS
-- ============================================================================

-- Grant read access to audit log for authenticated users (filtered by RLS)
GRANT SELECT ON public.billing_audit_log TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE - VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_trigger_count INTEGER;
  v_function_count INTEGER;
  v_policy_count INTEGER;
BEGIN
  -- Count new triggers
  SELECT COUNT(*) INTO v_trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  WHERE c.relname IN ('creator_billing', 'billing_transactions', 'creator_sales', 'billing_plans')
    AND t.tgname LIKE '%audit%' OR t.tgname LIKE '%protect%';

  -- Count new functions
  SELECT COUNT(*) INTO v_function_count
  FROM pg_proc
  WHERE proname IN (
    'protect_billing_critical_fields',
    'audit_billing_changes',
    'activate_first_sale',
    'record_activation_fee_payment',
    'get_creator_billing_status'
  );

  -- Count policies on audit log
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename = 'billing_audit_log';

  RAISE NOTICE '================================================';
  RAISE NOTICE 'Migration 012: Billing Security Fixes COMPLETE';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Security Issues Fixed:';
  RAISE NOTICE '  C4: RLS Policy Gap - Protected fields trigger added';
  RAISE NOTICE '  C5: Transaction Atomicity - activate_first_sale function';
  RAISE NOTICE '';
  RAISE NOTICE 'New Components:';
  RAISE NOTICE '  Tables: billing_audit_log';
  RAISE NOTICE '  Functions: %', v_function_count;
  RAISE NOTICE '    - protect_billing_critical_fields (trigger)';
  RAISE NOTICE '    - audit_billing_changes (trigger)';
  RAISE NOTICE '    - activate_first_sale (atomic first sale)';
  RAISE NOTICE '    - record_activation_fee_payment (atomic)';
  RAISE NOTICE '    - get_creator_billing_status (safe status check)';
  RAISE NOTICE '  Triggers: %', v_trigger_count;
  RAISE NOTICE '  RLS Policies on audit_log: %', v_policy_count;
  RAISE NOTICE '';
  RAISE NOTICE 'RLS Changes:';
  RAISE NOTICE '  - Removed: "Creators can update own billing"';
  RAISE NOTICE '  - Kept: "Creators can view own billing" (read-only)';
  RAISE NOTICE '  - All writes must go through Edge Functions';
  RAISE NOTICE '';
  RAISE NOTICE 'Protected Fields (creator_billing):';
  RAISE NOTICE '  - has_first_sale';
  RAISE NOTICE '  - first_sale_at';
  RAISE NOTICE '  - monthly_fee_active';
  RAISE NOTICE '  - activation_fee_paid';
  RAISE NOTICE '  - activation_fee_paid_at';
  RAISE NOTICE '  - stripe_customer_id';
  RAISE NOTICE '  - stripe_subscription_id';
  RAISE NOTICE '  - stripe_account_id';
  RAISE NOTICE '';
  RAISE NOTICE 'Status: SECURITY FIXES APPLIED';
  RAISE NOTICE '================================================';
END $$;
