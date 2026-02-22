-- ============================================
-- Migration: Creator Direct Messaging
-- ============================================
-- Extends the direct messaging system to support direct conversations
-- between creators and students (not just team members)
-- This enables creators to message students directly from Student Manager

-- ============================================
-- Schema Changes
-- ============================================

-- 1. Make team_member_id nullable (was NOT NULL)
ALTER TABLE direct_conversations
ALTER COLUMN team_member_id DROP NOT NULL;

-- 2. Add creator_profile_id column for creator-student conversations
ALTER TABLE direct_conversations
ADD COLUMN creator_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- 3. Add unread count for creator (mirrors unread_count_team)
ALTER TABLE direct_conversations
ADD COLUMN unread_count_creator INT DEFAULT 0;

-- 4. Add constraint: exactly one of team_member_id or creator_profile_id must be set
-- Drop the existing constraint if any issues, then add new one
ALTER TABLE direct_conversations
ADD CONSTRAINT one_participant_type CHECK (
  (team_member_id IS NOT NULL AND creator_profile_id IS NULL) OR
  (team_member_id IS NULL AND creator_profile_id IS NOT NULL)
);

-- 5. Create unique index for creator-student conversation pairs
CREATE UNIQUE INDEX idx_unique_creator_student_conversation
ON direct_conversations (community_id, student_profile_id, creator_profile_id)
WHERE creator_profile_id IS NOT NULL;

-- 6. Add index for creator lookup
CREATE INDEX IF NOT EXISTS idx_conversations_creator ON direct_conversations(creator_profile_id)
WHERE creator_profile_id IS NOT NULL;

-- ============================================
-- Update RLS Policies for direct_conversations
-- ============================================

-- Drop existing policies to recreate with creator support
DROP POLICY IF EXISTS "Users can view their conversations" ON direct_conversations;
DROP POLICY IF EXISTS "Students can create conversations" ON direct_conversations;
DROP POLICY IF EXISTS "Participants can update conversations" ON direct_conversations;

-- New SELECT policy: includes creator conversations
CREATE POLICY "Users can view their conversations" ON direct_conversations
  FOR SELECT
  TO authenticated
  USING (
    -- Student can see their own conversations
    student_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR
    -- Team member can see their own conversations
    (team_member_id IS NOT NULL AND team_member_id IN (
      SELECT id FROM community_team_members
      WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    ))
    OR
    -- Creator can see their direct conversations with students
    creator_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR
    -- Creator can see all conversations in their communities (oversight)
    community_id IN (
      SELECT id FROM communities
      WHERE creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- New INSERT policy: students can create conversations, creators can create conversations
CREATE POLICY "Users can create conversations" ON direct_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Students creating conversation with team member
    (
      student_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
      AND team_member_id IS NOT NULL
      AND community_id IN (
        SELECT community_id FROM memberships
        WHERE user_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
      )
    )
    OR
    -- Creator initiating conversation with student
    (
      creator_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
      AND team_member_id IS NULL
      AND community_id IN (
        SELECT id FROM communities
        WHERE creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
      )
    )
  );

-- New UPDATE policy: includes creator as participant
CREATE POLICY "Participants can update conversations" ON direct_conversations
  FOR UPDATE
  TO authenticated
  USING (
    student_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR
    (team_member_id IS NOT NULL AND team_member_id IN (
      SELECT id FROM community_team_members
      WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    ))
    OR
    creator_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- ============================================
-- Update RLS Policies for direct_messages
-- ============================================

-- Drop existing message policies to recreate with creator support
DROP POLICY IF EXISTS "Participants can view messages" ON direct_messages;
DROP POLICY IF EXISTS "Participants can send messages" ON direct_messages;
DROP POLICY IF EXISTS "Participants can update messages" ON direct_messages;

-- New SELECT policy for messages
CREATE POLICY "Participants can view messages" ON direct_messages
  FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM direct_conversations WHERE
        -- Student participant
        student_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR
        -- Team member participant
        (team_member_id IS NOT NULL AND team_member_id IN (
          SELECT id FROM community_team_members
          WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        ))
        OR
        -- Creator participant (their own conversations)
        creator_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR
        -- Creator oversight (can view all messages in their communities)
        community_id IN (
          SELECT id FROM communities
          WHERE creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    )
  );

-- New INSERT policy for messages (actual participants can send)
CREATE POLICY "Participants can send messages" ON direct_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Sender must be authenticated user
    sender_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND
    -- Must be a participant in the conversation (NOT creator oversight)
    conversation_id IN (
      SELECT id FROM direct_conversations WHERE
        -- Student participant
        student_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR
        -- Team member participant
        (team_member_id IS NOT NULL AND team_member_id IN (
          SELECT id FROM community_team_members
          WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        ))
        OR
        -- Creator participant (their own direct conversations)
        creator_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- New UPDATE policy for messages
CREATE POLICY "Participants can update messages" ON direct_messages
  FOR UPDATE
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM direct_conversations WHERE
        student_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR
        (team_member_id IS NOT NULL AND team_member_id IN (
          SELECT id FROM community_team_members
          WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        ))
        OR
        creator_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- ============================================
-- Update Unread Count Trigger
-- ============================================
-- Replace the trigger function to handle creator conversations

CREATE OR REPLACE FUNCTION update_conversation_unread_count()
RETURNS TRIGGER AS $$
DECLARE
  v_student_profile_id UUID;
  v_team_member_profile_id UUID;
  v_creator_profile_id UUID;
BEGIN
  -- Get conversation participants
  SELECT
    dc.student_profile_id,
    ctm.profile_id,
    dc.creator_profile_id
  INTO v_student_profile_id, v_team_member_profile_id, v_creator_profile_id
  FROM direct_conversations dc
  LEFT JOIN community_team_members ctm ON ctm.id = dc.team_member_id
  WHERE dc.id = NEW.conversation_id;

  -- Handle team member conversations
  IF v_team_member_profile_id IS NOT NULL THEN
    IF NEW.sender_profile_id = v_student_profile_id THEN
      -- Message from student, increment team member's unread count
      UPDATE direct_conversations
      SET unread_count_team = unread_count_team + 1
      WHERE id = NEW.conversation_id;
    ELSIF NEW.sender_profile_id = v_team_member_profile_id THEN
      -- Message from team member, increment student's unread count
      UPDATE direct_conversations
      SET unread_count_student = unread_count_student + 1
      WHERE id = NEW.conversation_id;
    END IF;
  -- Handle creator conversations
  ELSIF v_creator_profile_id IS NOT NULL THEN
    IF NEW.sender_profile_id = v_student_profile_id THEN
      -- Message from student, increment creator's unread count
      UPDATE direct_conversations
      SET unread_count_creator = unread_count_creator + 1
      WHERE id = NEW.conversation_id;
    ELSIF NEW.sender_profile_id = v_creator_profile_id THEN
      -- Message from creator, increment student's unread count
      UPDATE direct_conversations
      SET unread_count_student = unread_count_student + 1
      WHERE id = NEW.conversation_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Summary:
-- ============================================
-- This migration adds support for direct creator-to-student messaging:
-- 1. Creators can now initiate DM conversations with students
-- 2. team_member_id becomes nullable, creator_profile_id is the alternative
-- 3. Unread counts work for both team and creator conversations
-- 4. RLS policies updated to allow creators to send (not just view)
-- 5. Unique constraint prevents duplicate creator-student conversations
