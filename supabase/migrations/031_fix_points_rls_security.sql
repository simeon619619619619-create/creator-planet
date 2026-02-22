-- ============================================================================
-- FIX POINTS RLS SECURITY
-- ============================================================================
-- Migration: 031_fix_points_rls_security.sql
-- Created: 2026-02-04
--
-- SECURITY FIX: The previous "System can manage points" policy with
-- USING (true) WITH CHECK (true) allowed ANY authenticated user to award
-- points to anyone. This migration restricts point awarding to:
-- - Community creators (owners)
-- - Accepted team members of the community
--
-- This ensures server-side authorization that matches the client-side checks.
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTION: Get current user's profile ID
-- ============================================================================
-- Create this function if it doesn't exist (used by other RLS policies)
CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS UUID AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION: Check if user can award points in a community
-- ============================================================================
-- Returns true if the current user is either:
-- 1. The creator of the community
-- 2. An accepted team member of the community
CREATE OR REPLACE FUNCTION public.can_award_points_in_community(p_community_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  -- Get current user's profile ID
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- Return false if no profile found (shouldn't happen for authenticated users)
  IF v_profile_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if user is community creator
  IF EXISTS (
    SELECT 1 FROM public.communities
    WHERE id = p_community_id
    AND creator_id = v_profile_id
  ) THEN
    RETURN true;
  END IF;

  -- Check if user is an accepted team member
  IF EXISTS (
    SELECT 1 FROM public.community_team_members
    WHERE community_id = p_community_id
    AND profile_id = v_profile_id
    AND invite_status = 'accepted'
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- FIX POINTS TABLE RLS POLICIES
-- ============================================================================

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "System can manage points" ON public.points;
DROP POLICY IF EXISTS "System can insert points" ON public.points;

-- Drop any other policies that might conflict
DROP POLICY IF EXISTS "Creators can manage points in own communities" ON public.points;
DROP POLICY IF EXISTS "Creators and team members can manage points" ON public.points;
DROP POLICY IF EXISTS "Authorized users can insert points" ON public.points;
DROP POLICY IF EXISTS "Authorized users can update points" ON public.points;

-- Policy: Creators and team members can INSERT points
CREATE POLICY "Authorized users can insert points"
  ON public.points
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_award_points_in_community(community_id)
  );

-- Policy: Creators and team members can UPDATE points
-- (needed when updating total_points and level)
CREATE POLICY "Authorized users can update points"
  ON public.points
  FOR UPDATE
  TO authenticated
  USING (
    public.can_award_points_in_community(community_id)
  )
  WITH CHECK (
    public.can_award_points_in_community(community_id)
  );

-- ============================================================================
-- FIX POINT_TRANSACTIONS TABLE RLS POLICIES
-- ============================================================================

-- Drop any existing management policies
DROP POLICY IF EXISTS "System can insert transactions" ON public.point_transactions;
DROP POLICY IF EXISTS "System can insert point transactions" ON public.point_transactions;
DROP POLICY IF EXISTS "Authorized users can insert transactions" ON public.point_transactions;

-- Policy: Creators and team members can INSERT transactions
CREATE POLICY "Authorized users can insert transactions"
  ON public.point_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_award_points_in_community(community_id)
  );

-- ============================================================================
-- VERIFICATION COMMENTS
-- ============================================================================
-- After running this migration, verify with:
--
-- SELECT policyname, cmd, roles
-- FROM pg_policies
-- WHERE tablename IN ('points', 'point_transactions');
--
-- Expected policies for 'points':
-- - Users can view own points (SELECT)
-- - Creators can view community points (SELECT)
-- - Authorized users can insert points (INSERT)
-- - Authorized users can update points (UPDATE)
--
-- Expected policies for 'point_transactions':
-- - Users can view own transactions (SELECT)
-- - Creators can view community transactions (SELECT)
-- - Authorized users can insert transactions (INSERT)
-- ============================================================================
