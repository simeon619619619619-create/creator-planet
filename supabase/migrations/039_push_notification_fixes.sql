-- ============================================
-- Migration: Push Notification Security Fixes
-- ============================================
-- Fixes from Codex code review:
-- 1. Webhook trigger sends auth header (secret in SECURITY DEFINER)
-- 2. DM trigger has explicit participant checks
-- 3. All SECURITY DEFINER functions pin search_path

-- Fix 1+2: Webhook trigger with auth header
CREATE OR REPLACE FUNCTION notify_push_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://ilntxxutxbygjuixrzng.supabase.co/functions/v1/send-push-notification',
    headers := '{"Content-Type":"application/json","X-Webhook-Secret":"73d5c80c198abd586e883a16f88643bdd9f2598666883a43f9dd2484a12cc33e"}'::jsonb,
    body := jsonb_build_object(
      'record', jsonb_build_object(
        'id', NEW.id,
        'recipient_profile_id', NEW.recipient_profile_id,
        'type', NEW.type,
        'title', NEW.title,
        'body', NEW.body,
        'url', NEW.url,
        'data', NEW.data
      )
    ),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net, extensions;

-- Fix 3: DM trigger - explicit participant check
CREATE OR REPLACE FUNCTION notify_on_dm_message()
RETURNS TRIGGER AS $$
DECLARE
  v_recipient_profile_id UUID;
  v_sender_name TEXT;
  v_conversation RECORD;
  v_team_member_profile_id UUID;
BEGIN
  SELECT dc.student_profile_id, dc.team_member_id, dc.creator_profile_id
  INTO v_conversation
  FROM direct_conversations dc
  WHERE dc.id = NEW.conversation_id;

  IF v_conversation.team_member_id IS NOT NULL THEN
    SELECT ctm.profile_id INTO v_team_member_profile_id
    FROM community_team_members ctm
    WHERE ctm.id = v_conversation.team_member_id;
  END IF;

  IF NEW.sender_profile_id = v_conversation.student_profile_id THEN
    IF v_conversation.team_member_id IS NOT NULL AND v_team_member_profile_id IS NOT NULL THEN
      v_recipient_profile_id := v_team_member_profile_id;
    ELSIF v_conversation.creator_profile_id IS NOT NULL THEN
      v_recipient_profile_id := v_conversation.creator_profile_id;
    END IF;
  ELSIF v_team_member_profile_id IS NOT NULL AND NEW.sender_profile_id = v_team_member_profile_id THEN
    v_recipient_profile_id := v_conversation.student_profile_id;
  ELSIF v_conversation.creator_profile_id IS NOT NULL AND NEW.sender_profile_id = v_conversation.creator_profile_id THEN
    v_recipient_profile_id := v_conversation.student_profile_id;
  END IF;

  IF v_recipient_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.full_name, p.username, 'Someone') INTO v_sender_name
  FROM profiles p WHERE p.id = NEW.sender_profile_id;

  INSERT INTO notifications (recipient_profile_id, type, title, body, url, data)
  VALUES (
    v_recipient_profile_id, 'dm_message', v_sender_name,
    LEFT(NEW.content, 100), '/messages',
    jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id, 'sender_profile_id', NEW.sender_profile_id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix 4: Pin search_path on preferences trigger
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (profile_id)
  VALUES (NEW.id) ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
