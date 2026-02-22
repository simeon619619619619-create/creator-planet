-- Fix events RLS policies to use get_my_profile_id() instead of auth.uid()
-- This fixes the profile.id vs user.id mismatch that prevented some creators from creating events

-- Drop existing events policies
DROP POLICY IF EXISTS "Creators can manage own events" ON public.events;
DROP POLICY IF EXISTS "Creators can view own events" ON public.events;
DROP POLICY IF EXISTS "Users can view events they're invited to" ON public.events;
DROP POLICY IF EXISTS "Users can view events from their communities" ON public.events;

-- Create proper policies using get_my_profile_id()
CREATE POLICY "Creators can manage own events" ON public.events
  FOR ALL
  USING (creator_id = get_my_profile_id())
  WITH CHECK (creator_id = get_my_profile_id());

CREATE POLICY "Users can view events from their communities" ON public.events
  FOR SELECT
  USING (
    creator_id = get_my_profile_id()
    OR community_id IS NULL
    OR community_id IN (SELECT id FROM communities WHERE is_public = true)
    OR community_id IN (SELECT community_id FROM memberships WHERE user_id = get_my_profile_id())
  );

-- Fix event_attendees policies
DROP POLICY IF EXISTS "Users can manage own attendance" ON public.event_attendees;
DROP POLICY IF EXISTS "Creators can view event attendees" ON public.event_attendees;
DROP POLICY IF EXISTS "Users can view event attendees" ON public.event_attendees;
DROP POLICY IF EXISTS "Event creators can view attendees" ON public.event_attendees;
DROP POLICY IF EXISTS "Event creators can manage attendees" ON public.event_attendees;
DROP POLICY IF EXISTS "Users can RSVP to events" ON public.event_attendees;

CREATE POLICY "Users can manage own attendance" ON public.event_attendees
  FOR ALL
  USING (user_id = get_my_profile_id())
  WITH CHECK (user_id = get_my_profile_id());

CREATE POLICY "Creators can view event attendees" ON public.event_attendees
  FOR SELECT
  USING (
    event_id IN (SELECT id FROM events WHERE creator_id = get_my_profile_id())
  );

CREATE POLICY "Users can view event attendees" ON public.event_attendees
  FOR SELECT
  USING (
    event_id IN (SELECT id FROM events WHERE creator_id = get_my_profile_id())
    OR event_id IN (SELECT event_id FROM event_attendees WHERE user_id = get_my_profile_id())
  );
