-- Add attendance tracking to event_attendees table
-- This allows creators to mark which members actually attended an event (separate from RSVP)

-- Add attended column with default false
ALTER TABLE public.event_attendees
ADD COLUMN IF NOT EXISTS attended BOOLEAN DEFAULT FALSE;

-- Add attended_at timestamp to track when attendance was marked
ALTER TABLE public.event_attendees
ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ;

-- Create index for quick lookup of attendees by event and attendance status
CREATE INDEX IF NOT EXISTS idx_event_attendees_event_attended
ON public.event_attendees(event_id, attended);

-- Update RLS policy to allow creators to update attendance for their events
-- First drop existing policy if it exists
DROP POLICY IF EXISTS "Creators can update attendance for their events" ON public.event_attendees;

-- Create policy allowing creators to update attendance records for events they created
CREATE POLICY "Creators can update attendance for their events"
ON public.event_attendees
FOR UPDATE
TO authenticated
USING (
  event_id IN (
    SELECT id FROM public.events
    WHERE creator_id = get_my_profile_id()
  )
)
WITH CHECK (
  event_id IN (
    SELECT id FROM public.events
    WHERE creator_id = get_my_profile_id()
  )
);

-- Allow creators to insert attendance records for their events (for marking attendees who didn't RSVP)
DROP POLICY IF EXISTS "Creators can insert attendance for their events" ON public.event_attendees;

CREATE POLICY "Creators can insert attendance for their events"
ON public.event_attendees
FOR INSERT
TO authenticated
WITH CHECK (
  event_id IN (
    SELECT id FROM public.events
    WHERE creator_id = get_my_profile_id()
  )
);

-- Create a function to mark attendance that bypasses RLS for creator use
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
BEGIN
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION mark_event_attendance(UUID, UUID, BOOLEAN, UUID) TO authenticated;

COMMENT ON COLUMN public.event_attendees.attended IS 'Whether the member actually attended the event (marked by creator)';
COMMENT ON COLUMN public.event_attendees.attended_at IS 'Timestamp when attendance was marked';
COMMENT ON FUNCTION mark_event_attendance IS 'Marks a user as attended/not attended for an event. Only callable by the event creator.';
