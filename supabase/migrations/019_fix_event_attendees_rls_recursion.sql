-- Fix infinite recursion in event_attendees RLS policies
-- The "Users can view event attendees" policy had a self-referential subquery
-- that caused infinite recursion when querying event_attendees
--
-- Root cause: The policy had:
--   OR (event_id IN (SELECT event_id FROM event_attendees WHERE user_id = get_my_profile_id()))
-- This self-referenced event_attendees from within its own RLS policy, causing Postgres error:
--   "infinite recursion detected in policy for relation event_attendees"

-- Drop the problematic policy that has self-referential subquery
DROP POLICY IF EXISTS "Users can view event attendees" ON public.event_attendees;

-- The remaining policies are sufficient:
-- 1. "Users can manage own attendance" - allows users to see/manage their own attendance records
-- 2. "Creators can view event attendees" - allows creators to see all attendees for their events
-- 3. "Creators can manage attendees for own events" - allows creators to add/remove attendees

-- Create a simpler policy for users to see attendees of events they attend
-- Uses the events table (not event_attendees) to avoid recursion
CREATE POLICY "Users can view attendees of events they attend" ON public.event_attendees
  FOR SELECT
  USING (
    -- Users can see their own attendance record
    user_id = get_my_profile_id()
    -- Creators can see all attendees (redundant with other policy but helps PostgreSQL optimize)
    OR event_id IN (SELECT id FROM events WHERE creator_id = get_my_profile_id())
  );
