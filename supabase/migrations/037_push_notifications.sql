-- ============================================
-- Migration: Push Notifications System
-- ============================================
-- Adds push subscriptions, notification preferences,
-- notification log, and DM notification trigger.
-- Phase 1: DM message notifications end-to-end.

-- ============================================
-- Table: push_subscriptions
-- ============================================
-- One row per device per user (browser push subscription)

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_subscription_per_device UNIQUE (profile_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_profile ON push_subscriptions(profile_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscriptions
CREATE POLICY "Users can view own push subscriptions" ON push_subscriptions
  FOR SELECT TO authenticated
  USING (profile_id = get_my_profile_id());

-- Users can insert their own subscriptions
CREATE POLICY "Users can create push subscriptions" ON push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = get_my_profile_id());

-- Users can delete their own subscriptions
CREATE POLICY "Users can delete push subscriptions" ON push_subscriptions
  FOR DELETE TO authenticated
  USING (profile_id = get_my_profile_id());

-- Users can update their own subscriptions (last_used_at)
CREATE POLICY "Users can update push subscriptions" ON push_subscriptions
  FOR UPDATE TO authenticated
  USING (profile_id = get_my_profile_id());


-- ============================================
-- Table: notification_preferences
-- ============================================
-- One row per user, boolean columns for each notification category

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  push_enabled BOOLEAN DEFAULT true,
  dm_messages BOOLEAN DEFAULT true,
  event_created BOOLEAN DEFAULT true,
  event_reminder BOOLEAN DEFAULT true,
  course_new_lesson BOOLEAN DEFAULT true,
  course_enrollment BOOLEAN DEFAULT true,
  community_new_post BOOLEAN DEFAULT true,
  community_comment_reply BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_prefs_per_user UNIQUE (profile_id)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view own notification preferences" ON notification_preferences
  FOR SELECT TO authenticated
  USING (profile_id = get_my_profile_id());

-- Users can insert their own preferences
CREATE POLICY "Users can create notification preferences" ON notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = get_my_profile_id());

-- Users can update their own preferences
CREATE POLICY "Users can update notification preferences" ON notification_preferences
  FOR UPDATE TO authenticated
  USING (profile_id = get_my_profile_id());


-- ============================================
-- Table: notifications
-- ============================================
-- Immutable notification log (also serves as future inbox)

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'dm_message',
    'event_created',
    'event_reminder',
    'course_new_lesson',
    'course_enrollment',
    'community_new_post',
    'community_comment_reply'
  )),
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  is_pushed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_profile_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(recipient_profile_id, is_read)
  WHERE NOT is_read;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT TO authenticated
  USING (recipient_profile_id = get_my_profile_id());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE TO authenticated
  USING (recipient_profile_id = get_my_profile_id());

-- INSERT handled by SECURITY DEFINER trigger only (no direct user INSERT)
-- Service role can also insert via edge functions


-- ============================================
-- Trigger: create default notification preferences
-- ============================================
-- Auto-creates preferences row for every new user

CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (profile_id)
  VALUES (NEW.id)
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_create_notification_preferences
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_preferences();

-- Backfill existing users
INSERT INTO notification_preferences (profile_id)
SELECT id FROM profiles
ON CONFLICT (profile_id) DO NOTHING;


-- ============================================
-- Trigger: notify on DM message
-- ============================================
-- AFTER INSERT on direct_messages, creates a notification for the recipient

CREATE OR REPLACE FUNCTION notify_on_dm_message()
RETURNS TRIGGER AS $$
DECLARE
  v_recipient_profile_id UUID;
  v_sender_name TEXT;
  v_conversation RECORD;
BEGIN
  -- Get conversation details
  SELECT
    dc.student_profile_id,
    dc.team_member_id,
    dc.creator_profile_id
  INTO v_conversation
  FROM direct_conversations dc
  WHERE dc.id = NEW.conversation_id;

  -- Determine recipient (the person who did NOT send the message)
  IF NEW.sender_profile_id = v_conversation.student_profile_id THEN
    -- Student sent the message -> notify team member or creator
    IF v_conversation.team_member_id IS NOT NULL THEN
      SELECT ctm.profile_id INTO v_recipient_profile_id
      FROM community_team_members ctm
      WHERE ctm.id = v_conversation.team_member_id;
    ELSIF v_conversation.creator_profile_id IS NOT NULL THEN
      v_recipient_profile_id := v_conversation.creator_profile_id;
    END IF;
  ELSE
    -- Team member or creator sent -> notify student
    v_recipient_profile_id := v_conversation.student_profile_id;
  END IF;

  -- If no recipient found, skip
  IF v_recipient_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get sender display name
  SELECT COALESCE(p.full_name, p.username, 'Someone') INTO v_sender_name
  FROM profiles p
  WHERE p.id = NEW.sender_profile_id;

  -- Insert notification
  INSERT INTO notifications (
    recipient_profile_id,
    type,
    title,
    body,
    url,
    data
  ) VALUES (
    v_recipient_profile_id,
    'dm_message',
    v_sender_name,
    LEFT(NEW.content, 100),
    '/messages',
    jsonb_build_object(
      'conversation_id', NEW.conversation_id,
      'message_id', NEW.id,
      'sender_profile_id', NEW.sender_profile_id
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_on_dm_message
  AFTER INSERT ON direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_dm_message();


-- ============================================
-- Updated_at trigger for notification_preferences
-- ============================================

CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notification_preferences_timestamp
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_updated_at();
