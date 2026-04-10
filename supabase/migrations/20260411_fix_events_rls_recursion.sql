-- Fix infinite recursion in events RLS policies
-- The recursion was: events SELECT → event_attendees subquery → event_attendees SELECT RLS → events subquery → loop

-- Drop ALL policy that acted as SELECT too (causing double evaluation)
DROP POLICY IF EXISTS "Creators can manage own events" ON events;

-- Drop all redundant overlapping SELECT policies
DROP POLICY IF EXISTS "Users can view public events" ON events;
DROP POLICY IF EXISTS "Users can view events from their communities" ON events;
DROP POLICY IF EXISTS "Members can view events in joined communities" ON events;
DROP POLICY IF EXISTS "Users can view events they're attending" ON events;
DROP POLICY IF EXISTS "Team members can view community events" ON events;
DROP POLICY IF EXISTS "Superadmins can view all events" ON events;
DROP POLICY IF EXISTS "Users can view events" ON events;

-- Replace ALL with separate INSERT/UPDATE/DELETE for creators
CREATE POLICY "Creators can insert events" ON events FOR INSERT TO authenticated
WITH CHECK (creator_id = get_my_profile_id());

CREATE POLICY "Creators can update own events" ON events FOR UPDATE TO authenticated
USING (creator_id = get_my_profile_id());

CREATE POLICY "Creators can delete own events" ON events FOR DELETE TO authenticated
USING (creator_id = get_my_profile_id());

-- Single clean SELECT policy — NO subquery on event_attendees (avoids recursion)
CREATE POLICY "Users can view events" ON events FOR SELECT TO authenticated
USING (
  creator_id = get_my_profile_id()
  OR community_id IS NULL
  OR community_id IN (SELECT get_my_membership_community_ids())
  OR is_superadmin()
);
