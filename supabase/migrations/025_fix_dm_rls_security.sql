-- ============================================================================
-- FIX DIRECT MESSAGING RLS SECURITY ISSUES
-- Migration: 025_fix_dm_rls_security.sql
--
-- Fixes identified in code review:
-- 1. Conversation INSERT policy doesn't validate team_member_id belongs to
--    the same community and is accepted/messageable
-- 2. Message UPDATE policy allows modifying any field (should only allow read_at)
-- ============================================================================

-- ============================================
-- Fix 1: Conversation INSERT policy
-- ============================================

-- Drop the existing policy
DROP POLICY IF EXISTS "Students can create conversations" ON direct_conversations;

-- Recreate with proper team_member validation
CREATE POLICY "Students can create conversations" ON direct_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Must be the student in the conversation
    student_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND
    -- Must be a member of the community
    community_id IN (
      SELECT community_id FROM memberships
      WHERE user_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
    AND
    -- Team member must belong to the same community, be accepted, and messageable
    team_member_id IN (
      SELECT id FROM community_team_members
      WHERE community_id = direct_conversations.community_id
        AND invite_status = 'accepted'
        AND is_messageable = true
    )
  );

-- ============================================
-- Fix 2: Message UPDATE policy (restrict to read_at only)
-- ============================================

-- Drop the existing policy
DROP POLICY IF EXISTS "Participants can update messages" ON direct_messages;

-- Recreate with WITH CHECK that preserves immutable fields
-- This ensures only read_at can be changed by checking other fields remain unchanged
CREATE POLICY "Participants can update messages" ON direct_messages
  FOR UPDATE
  TO authenticated
  USING (
    -- Only conversation participants can update
    conversation_id IN (
      SELECT id FROM direct_conversations WHERE
        student_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR
        team_member_id IN (
          SELECT id FROM community_team_members
          WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    -- Only conversation participants can update
    conversation_id IN (
      SELECT id FROM direct_conversations WHERE
        student_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR
        team_member_id IN (
          SELECT id FROM community_team_members
          WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    )
    -- Note: PostgreSQL RLS can't directly restrict which columns are updated.
    -- The WITH CHECK ensures the row still matches access rules after update.
    -- To fully restrict updates to read_at only, we add a trigger.
  );

-- Add trigger to enforce only read_at can be updated
CREATE OR REPLACE FUNCTION enforce_message_update_restrictions()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow read_at to be changed
  IF OLD.conversation_id != NEW.conversation_id
     OR OLD.sender_profile_id != NEW.sender_profile_id
     OR OLD.content != NEW.content
     OR OLD.created_at != NEW.created_at
  THEN
    RAISE EXCEPTION 'Only read_at field can be updated on messages';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop if exists and create the trigger
DROP TRIGGER IF EXISTS enforce_message_immutability ON direct_messages;
CREATE TRIGGER enforce_message_immutability
  BEFORE UPDATE ON direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION enforce_message_update_restrictions();

-- ============================================
-- Fix 3: Conversation UPDATE policy (add WITH CHECK)
-- ============================================

-- Drop the existing policy
DROP POLICY IF EXISTS "Participants can update conversations" ON direct_conversations;

-- Recreate with WITH CHECK to prevent reassigning participants/community
CREATE POLICY "Participants can update conversations" ON direct_conversations
  FOR UPDATE
  TO authenticated
  USING (
    student_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR
    team_member_id IN (
      SELECT id FROM community_team_members
      WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    -- Same access check applies after update
    student_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR
    team_member_id IN (
      SELECT id FROM community_team_members
      WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Add trigger to prevent changing critical conversation fields
CREATE OR REPLACE FUNCTION enforce_conversation_update_restrictions()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent changing participant IDs or community
  IF OLD.student_profile_id != NEW.student_profile_id
     OR OLD.team_member_id != NEW.team_member_id
     OR OLD.community_id != NEW.community_id
  THEN
    RAISE EXCEPTION 'Cannot change conversation participants or community';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop if exists and create the trigger
DROP TRIGGER IF EXISTS enforce_conversation_immutability ON direct_conversations;
CREATE TRIGGER enforce_conversation_immutability
  BEFORE UPDATE ON direct_conversations
  FOR EACH ROW
  EXECUTE FUNCTION enforce_conversation_update_restrictions();
