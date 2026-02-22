-- Fix: Allow creators to view profiles of their event attendees
-- The original approach caused RLS recursion issues.
-- Solution: Use SECURITY DEFINER functions to bypass RLS internally.

-- =============================================================================
-- 1. Safe function to get event attendee profile IDs (for profile viewing policy)
-- =============================================================================
CREATE OR REPLACE FUNCTION get_my_event_attendee_profile_ids()
RETURNS SETOF UUID
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_profile_id UUID;
BEGIN
  -- Get my profile ID (bypasses RLS because SECURITY DEFINER)
  SELECT id INTO my_profile_id FROM profiles WHERE user_id = auth.uid();

  IF my_profile_id IS NULL THEN
    RETURN;
  END IF;

  -- Return profiles of attendees at events I created
  RETURN QUERY
    SELECT DISTINCT ea.user_id
    FROM event_attendees ea
    JOIN events e ON e.id = ea.event_id
    WHERE e.creator_id = my_profile_id;
END;
$$;

-- =============================================================================
-- 2. Profile viewing policy using the safe function
-- =============================================================================
DROP POLICY IF EXISTS "Creators can view event attendee profiles" ON profiles;

CREATE POLICY "Creators can view event attendee profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  id IN (SELECT get_my_event_attendee_profile_ids())
);

-- =============================================================================
-- 3. Function to fetch event attendees with profiles (for AttendanceModal)
-- =============================================================================
CREATE OR REPLACE FUNCTION get_event_attendees_with_profiles(p_event_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  event_id UUID,
  status TEXT,
  attended BOOLEAN,
  attended_at TIMESTAMPTZ,
  profile_id UUID,
  profile_name TEXT,
  profile_email TEXT,
  profile_avatar TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_my_profile_id UUID;
  v_event_creator_id UUID;
BEGIN
  -- Get caller's profile ID
  SELECT p.id INTO v_my_profile_id FROM profiles p WHERE p.user_id = auth.uid();

  -- Get event creator
  SELECT e.creator_id INTO v_event_creator_id FROM events e WHERE e.id = p_event_id;

  -- Only allow if caller is the event creator
  IF v_my_profile_id IS NULL OR v_my_profile_id != v_event_creator_id THEN
    RETURN;
  END IF;

  -- Return attendees with profiles (bypasses RLS because SECURITY DEFINER)
  RETURN QUERY
    SELECT
      ea.id,
      ea.user_id,
      ea.event_id,
      ea.status::TEXT,
      COALESCE(ea.attended, false),
      ea.attended_at,
      p.id as profile_id,
      COALESCE(p.full_name, p.email, 'Unknown') as profile_name,
      COALESCE(p.email, '') as profile_email,
      p.avatar_url as profile_avatar
    FROM event_attendees ea
    LEFT JOIN profiles p ON p.id = ea.user_id
    WHERE ea.event_id = p_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_event_attendees_with_profiles(UUID) TO authenticated;
