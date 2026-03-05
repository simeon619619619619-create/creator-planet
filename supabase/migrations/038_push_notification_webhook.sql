-- ============================================
-- Migration: Push Notification Database Webhook
-- ============================================
-- Uses pg_net to call the send-push-notification edge function
-- when a new notification is inserted.

-- Enable pg_net for async HTTP from triggers
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Database webhook: call send-push-notification edge function on notifications INSERT
CREATE OR REPLACE FUNCTION notify_push_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT;
BEGIN
  edge_function_url := 'https://ilntxxutxbygjuixrzng.supabase.co/functions/v1/send-push-notification';

  PERFORM net.http_post(
    url := edge_function_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_push_notification_webhook
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION notify_push_on_insert();
