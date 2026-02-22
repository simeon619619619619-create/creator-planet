-- ============================================
-- Migration: Direct Messaging System
-- ============================================
-- Adds 1:1 direct messaging between students and community team members
-- (lecturers, assistants, guest experts)
-- Enables support/Q&A and casual community engagement

-- ============================================
-- Create Tables
-- ============================================

-- Team members within a community
CREATE TABLE IF NOT EXISTS community_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('lecturer', 'assistant', 'guest_expert')),
  title TEXT, -- "Course Instructor", "Guest Speaker", etc.
  bio TEXT, -- Short description shown to students
  is_messageable BOOLEAN DEFAULT true,
  invited_email TEXT, -- For pending invites (before account created)
  invite_status TEXT DEFAULT 'accepted' CHECK (invite_status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Either profile_id OR invited_email must be set
  CONSTRAINT profile_or_invite CHECK (
    (profile_id IS NOT NULL AND invited_email IS NULL) OR
    (profile_id IS NULL AND invited_email IS NOT NULL)
  ),
  -- Unique team member per community (only for accepted members with profile_id)
  CONSTRAINT unique_team_member_per_community UNIQUE (community_id, profile_id)
);

-- Conversation between student and team member
CREATE TABLE IF NOT EXISTS direct_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  student_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES community_team_members(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  unread_count_student INT DEFAULT 0,
  unread_count_team INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One conversation per student-team member pair
  UNIQUE (community_id, student_profile_id, team_member_id)
);

-- Individual messages
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  sender_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Create Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_team_members_community ON community_team_members(community_id);
CREATE INDEX IF NOT EXISTS idx_team_members_profile ON community_team_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_team_members_invite_email ON community_team_members(invited_email) WHERE invited_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_student ON direct_conversations(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_conversations_team_member ON direct_conversations(team_member_id);
CREATE INDEX IF NOT EXISTS idx_conversations_community ON direct_conversations(community_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON direct_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON direct_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON direct_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON direct_messages(sender_profile_id);

-- ============================================
-- Enable RLS
-- ============================================

ALTER TABLE community_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for community_team_members
-- ============================================

-- Community members can view team (SELECT only)
CREATE POLICY "Community members can view team" ON community_team_members
  FOR SELECT
  TO authenticated
  USING (
    community_id IN (
      SELECT community_id FROM memberships
      WHERE user_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
    OR
    -- Also allow community creators to see their team
    community_id IN (
      SELECT id FROM communities
      WHERE creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Creator can insert team members
CREATE POLICY "Creator can add team members" ON community_team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    community_id IN (
      SELECT id FROM communities
      WHERE creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Creator can update team members
CREATE POLICY "Creator can update team members" ON community_team_members
  FOR UPDATE
  TO authenticated
  USING (
    community_id IN (
      SELECT id FROM communities
      WHERE creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Creator can delete team members
CREATE POLICY "Creator can delete team members" ON community_team_members
  FOR DELETE
  TO authenticated
  USING (
    community_id IN (
      SELECT id FROM communities
      WHERE creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- ============================================
-- RLS Policies for direct_conversations
-- ============================================

-- Users can view conversations they're part of (students, team members, or community creators)
CREATE POLICY "Users can view their conversations" ON direct_conversations
  FOR SELECT
  TO authenticated
  USING (
    -- Student can see their own conversations
    student_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR
    -- Team member can see their own conversations
    team_member_id IN (
      SELECT id FROM community_team_members
      WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
    OR
    -- Creator can see all conversations in their communities (oversight)
    community_id IN (
      SELECT id FROM communities
      WHERE creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Students can create conversations with team members
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
  );

-- Participants can update conversations (for unread counts)
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
  );

-- ============================================
-- RLS Policies for direct_messages
-- ============================================

-- Conversation participants can view messages (creator can also view for oversight)
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
        team_member_id IN (
          SELECT id FROM community_team_members
          WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
        OR
        -- Creator oversight (can view all messages in their communities)
        community_id IN (
          SELECT id FROM communities
          WHERE creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    )
  );

-- Only actual participants can send messages (NOT creator - oversight only)
CREATE POLICY "Participants can send messages" ON direct_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Sender must be authenticated user
    sender_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND
    -- Must be a participant in the conversation
    conversation_id IN (
      SELECT id FROM direct_conversations WHERE
        -- Student participant
        student_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR
        -- Team member participant
        team_member_id IN (
          SELECT id FROM community_team_members
          WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    )
  );

-- Participants can update messages (for read_at marking)
CREATE POLICY "Participants can update messages" ON direct_messages
  FOR UPDATE
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM direct_conversations WHERE
        student_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR
        team_member_id IN (
          SELECT id FROM community_team_members
          WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    )
  );

-- ============================================
-- Trigger to update last_message_at
-- ============================================

CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE direct_conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_conversation_last_message
  AFTER INSERT ON direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- ============================================
-- Trigger to update unread counts
-- ============================================

CREATE OR REPLACE FUNCTION update_conversation_unread_count()
RETURNS TRIGGER AS $$
DECLARE
  v_student_profile_id UUID;
  v_team_member_profile_id UUID;
BEGIN
  -- Get conversation participants
  SELECT
    dc.student_profile_id,
    ctm.profile_id
  INTO v_student_profile_id, v_team_member_profile_id
  FROM direct_conversations dc
  JOIN community_team_members ctm ON ctm.id = dc.team_member_id
  WHERE dc.id = NEW.conversation_id;

  -- Increment unread count for the recipient
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_unread_count
  AFTER INSERT ON direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_unread_count();

-- ============================================
-- updated_at trigger for team members
-- ============================================

CREATE OR REPLACE FUNCTION update_team_member_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_team_member_timestamp
  BEFORE UPDATE ON community_team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_team_member_updated_at();

-- ============================================
-- Cascade Delete Summary:
-- ============================================
-- When a community is deleted:
--   -> community_team_members (via ON DELETE CASCADE from community_id)
--     -> direct_conversations (via ON DELETE CASCADE from team_member_id)
--       -> direct_messages (via ON DELETE CASCADE from conversation_id)
--
-- When a profile is deleted:
--   -> community_team_members (via ON DELETE CASCADE from profile_id)
--   -> direct_conversations (via ON DELETE CASCADE from student_profile_id)
--   -> direct_messages (via ON DELETE CASCADE from sender_profile_id)
--
-- This ensures ALL DM data is cleaned up properly.
