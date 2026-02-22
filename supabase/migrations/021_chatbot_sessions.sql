-- ============================================
-- Migration: Chat Sessions & Messages Tables
-- ============================================
-- Adds session-based chat history for community chatbots
-- Ensures proper cascade delete when chatbots are removed

-- ============================================
-- Create Tables
-- ============================================

-- Chat sessions - groups messages into conversations
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id UUID NOT NULL REFERENCES community_chatbots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages - individual messages within a session
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'model')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Create Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_chat_sessions_chatbot ON chat_sessions(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

-- ============================================
-- Enable RLS
-- ============================================

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for chat_sessions
-- ============================================

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions" ON chat_sessions
  FOR SELECT USING (
    user_id IN (SELECT id FROM profiles WHERE profiles.user_id = auth.uid())
  );

-- Users can create sessions for themselves
CREATE POLICY "Users can create own sessions" ON chat_sessions
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM profiles WHERE profiles.user_id = auth.uid())
  );

-- Users can update their own sessions
CREATE POLICY "Users can update own sessions" ON chat_sessions
  FOR UPDATE USING (
    user_id IN (SELECT id FROM profiles WHERE profiles.user_id = auth.uid())
  );

-- Users can delete their own sessions
CREATE POLICY "Users can delete own sessions" ON chat_sessions
  FOR DELETE USING (
    user_id IN (SELECT id FROM profiles WHERE profiles.user_id = auth.uid())
  );

-- ============================================
-- RLS Policies for chat_messages
-- ============================================

-- Users can view messages in their own sessions
CREATE POLICY "Users can view own messages" ON chat_messages
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM chat_sessions
      WHERE user_id IN (SELECT id FROM profiles WHERE profiles.user_id = auth.uid())
    )
  );

-- Users can add messages to their own sessions
CREATE POLICY "Users can add own messages" ON chat_messages
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT id FROM chat_sessions
      WHERE user_id IN (SELECT id FROM profiles WHERE profiles.user_id = auth.uid())
    )
  );

-- Users can delete messages in their own sessions
CREATE POLICY "Users can delete own messages" ON chat_messages
  FOR DELETE USING (
    session_id IN (
      SELECT id FROM chat_sessions
      WHERE user_id IN (SELECT id FROM profiles WHERE profiles.user_id = auth.uid())
    )
  );

-- ============================================
-- Cascade Delete Summary:
-- ============================================
-- When a chatbot is deleted:
--   → chat_sessions (via ON DELETE CASCADE from chatbot_id)
--     → chat_messages (via ON DELETE CASCADE from session_id)
--   → chatbot_conversations (existing, via ON DELETE CASCADE)
--
-- This ensures ALL chat data is cleaned up when a chatbot is removed.
