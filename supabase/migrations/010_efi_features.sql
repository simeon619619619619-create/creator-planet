-- EFI Features: Community Chatbots and Homework System
-- Migration: 010_efi_features.sql
-- Created: 2025-01-28

-- ============================================
-- Community Chatbots
-- ============================================

CREATE TABLE community_chatbots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('qa', 'motivation', 'support')),
  system_prompt TEXT,
  personality TEXT,
  greeting_message TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chatbot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id UUID NOT NULL REFERENCES community_chatbots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chatbot_id, user_id)
);

-- ============================================
-- Homework System
-- ============================================

CREATE TABLE homework_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  max_points INTEGER DEFAULT 10 CHECK (max_points >= 1 AND max_points <= 10),
  due_date TIMESTAMPTZ,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE homework_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES homework_assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  text_response TEXT,
  file_urls JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'graded')),
  points_awarded INTEGER CHECK (points_awarded >= 0 AND points_awarded <= 10),
  feedback TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  graded_at TIMESTAMPTZ,
  graded_by UUID,
  UNIQUE(assignment_id, student_id)
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX idx_chatbots_community ON community_chatbots(community_id);
CREATE INDEX idx_conversations_chatbot ON chatbot_conversations(chatbot_id);
CREATE INDEX idx_conversations_user ON chatbot_conversations(user_id);
CREATE INDEX idx_assignments_community ON homework_assignments(community_id);
CREATE INDEX idx_assignments_published ON homework_assignments(is_published);
CREATE INDEX idx_submissions_assignment ON homework_submissions(assignment_id);
CREATE INDEX idx_submissions_student ON homework_submissions(student_id);
CREATE INDEX idx_submissions_status ON homework_submissions(status);

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE community_chatbots ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_submissions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Chatbot Policies
-- ============================================

-- Chatbots: anyone in community can read active bots
CREATE POLICY "Users can view active chatbots" ON community_chatbots
  FOR SELECT USING (is_active = true);

CREATE POLICY "Creators can manage chatbots" ON community_chatbots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM communities c
      JOIN profiles p ON c.creator_id = p.id
      WHERE c.id = community_id AND p.user_id = auth.uid()
    )
  );

-- ============================================
-- Conversation Policies
-- ============================================

-- Conversations: users can manage their own
CREATE POLICY "Users can manage own conversations" ON chatbot_conversations
  FOR ALL USING (user_id = auth.uid());

-- ============================================
-- Assignment Policies
-- ============================================

-- Assignments: published visible to members, creators can manage all
CREATE POLICY "Members can view published assignments" ON homework_assignments
  FOR SELECT USING (is_published = true);

CREATE POLICY "Creators can manage assignments" ON homework_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = creator_id AND p.user_id = auth.uid()
    )
  );

-- ============================================
-- Submission Policies
-- ============================================

-- Submissions: students manage own, creators can view/update all in community
CREATE POLICY "Students can manage own submissions" ON homework_submissions
  FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Creators can view community submissions" ON homework_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM homework_assignments ha
      JOIN communities c ON ha.community_id = c.id
      JOIN profiles p ON c.creator_id = p.id
      WHERE ha.id = assignment_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Creators can grade submissions" ON homework_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM homework_assignments ha
      JOIN communities c ON ha.community_id = c.id
      JOIN profiles p ON c.creator_id = p.id
      WHERE ha.id = assignment_id AND p.user_id = auth.uid()
    )
  );
