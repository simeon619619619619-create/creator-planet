-- Fix security vulnerability in mark_event_attendance function
-- The function accepted p_creator_id as a parameter but didn't verify the caller
-- actually owns that profile. This allowed privilege escalation by passing any creator_id.

-- Drop and recreate the function with proper caller verification
CREATE OR REPLACE FUNCTION mark_event_attendance(
  p_event_id UUID,
  p_user_id UUID,
  p_attended BOOLEAN,
  p_creator_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_creator_id UUID;
  v_caller_profile_id UUID;
BEGIN
  -- SECURITY FIX: Verify the caller actually owns the profile they claim to be
  v_caller_profile_id := get_my_profile_id();

  IF v_caller_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_caller_profile_id != p_creator_id THEN
    RAISE EXCEPTION 'Caller must match the provided creator_id';
  END IF;

  -- Verify the caller is the event creator
  SELECT creator_id INTO v_event_creator_id
  FROM events
  WHERE id = p_event_id;

  IF v_event_creator_id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF v_event_creator_id != p_creator_id THEN
    RAISE EXCEPTION 'Only the event creator can mark attendance';
  END IF;

  -- Upsert the attendance record
  INSERT INTO event_attendees (event_id, user_id, status, attended, attended_at, responded_at)
  VALUES (p_event_id, p_user_id, 'attending', p_attended, CASE WHEN p_attended THEN NOW() ELSE NULL END, NOW())
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET
    attended = p_attended,
    attended_at = CASE WHEN p_attended THEN NOW() ELSE NULL END;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION mark_event_attendance IS 'Marks a user as attended/not attended for an event. Only callable by the event creator. Verifies caller identity.';
