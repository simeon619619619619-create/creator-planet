-- ============================================================================
-- GATED COMMUNITY ACCESS
-- ============================================================================
-- Allows creators to require application approval before users can join free communities.
-- Paid communities always have direct access after payment.
--
-- This migration documents schema changes that were applied via MCP and includes
-- security fixes for the membership RLS policy.
-- ============================================================================

-- 1. Add access_type column to communities
-- ============================================================================
-- 'open' = anyone can join instantly (default)
-- 'gated' = users must apply and be approved by creator

ALTER TABLE communities
ADD COLUMN IF NOT EXISTS access_type TEXT DEFAULT 'open';

-- 2. Create community_applications table
-- ============================================================================
CREATE TABLE IF NOT EXISTS community_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT,                                    -- Optional intro message from applicant
  status TEXT NOT NULL DEFAULT 'pending',          -- 'pending', 'approved', 'rejected'
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id),        -- Creator who reviewed

  -- Prevent duplicate applications from same user to same community
  CONSTRAINT community_applications_community_id_user_id_key UNIQUE (community_id, user_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_community_applications_community
  ON community_applications(community_id);
CREATE INDEX IF NOT EXISTS idx_community_applications_user
  ON community_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_community_applications_status
  ON community_applications(status);

-- 3. Enable RLS on community_applications
-- ============================================================================
ALTER TABLE community_applications ENABLE ROW LEVEL SECURITY;

-- Users can submit applications (only for themselves)
DROP POLICY IF EXISTS "Users can apply to communities" ON community_applications;
CREATE POLICY "Users can apply to communities" ON community_applications
FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Users can view their own applications
DROP POLICY IF EXISTS "Users can view own applications" ON community_applications;
CREATE POLICY "Users can view own applications" ON community_applications
FOR SELECT TO authenticated
USING (
  user_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Creators can view applications for their communities
DROP POLICY IF EXISTS "Creators can view applications for their communities" ON community_applications;
CREATE POLICY "Creators can view applications for their communities" ON community_applications
FOR SELECT TO authenticated
USING (
  community_id IN (
    SELECT id FROM communities
    WHERE creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

-- Creators can review (update) applications for their communities
DROP POLICY IF EXISTS "Creators can review applications" ON community_applications;
CREATE POLICY "Creators can review applications" ON community_applications
FOR UPDATE TO authenticated
USING (
  community_id IN (
    SELECT id FROM communities
    WHERE creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

-- 4. SECURITY FIX: Update memberships policy to enforce gating
-- ============================================================================
-- The original policy allowed any user to insert themselves into any community.
-- This was a security hole - users could bypass the apply modal for gated communities.

DROP POLICY IF EXISTS "Users can join communities" ON memberships;

-- New policy: Users can only join if:
-- 1. They're inserting for themselves
-- 2. AND either:
--    a. The community is NOT gated
--    b. OR they have an approved application
CREATE POLICY "Users can join communities" ON memberships
FOR INSERT TO authenticated
WITH CHECK (
  user_id = get_my_profile_id()
  AND (
    -- Community is not gated
    NOT EXISTS (
      SELECT 1 FROM communities c
      WHERE c.id = community_id
      AND c.access_type = 'gated'
    )
    OR
    -- User has an approved application
    EXISTS (
      SELECT 1 FROM community_applications ca
      WHERE ca.community_id = memberships.community_id
      AND ca.user_id = memberships.user_id
      AND ca.status = 'approved'
    )
  )
);
