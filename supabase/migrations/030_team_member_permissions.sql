-- ============================================
-- Migration: Team Member Permissions
-- ============================================
-- Adds RLS policies to allow team members (lecturers, assistants) to:
-- 1. Create and manage calendar events
-- 2. View and grade homework submissions
-- 3. Award bonus points to students
-- 4. View community members

-- ============================================
-- Helper: Check if user is team member with specific roles
-- ============================================

CREATE OR REPLACE FUNCTION is_team_member_with_role(
  p_community_id UUID,
  p_allowed_roles TEXT[]
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM community_team_members ctm
    WHERE ctm.community_id = p_community_id
      AND ctm.profile_id = get_my_profile_id()
      AND ctm.invite_status = 'accepted'
      AND ctm.role = ANY(p_allowed_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- 1. Calendar Events - Team Member Access
-- ============================================

-- Team members can create events in their community
CREATE POLICY "Team members can create events"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_team_member_with_role(community_id, ARRAY['lecturer', 'assistant'])
  );

-- Team members can update events they created
CREATE POLICY "Team members can update own events"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    creator_id = get_my_profile_id()
    AND is_team_member_with_role(community_id, ARRAY['lecturer', 'assistant'])
  );

-- Team members can delete events they created
CREATE POLICY "Team members can delete own events"
  ON public.events
  FOR DELETE
  TO authenticated
  USING (
    creator_id = get_my_profile_id()
    AND is_team_member_with_role(community_id, ARRAY['lecturer', 'assistant'])
  );

-- Team members can view events in their communities
CREATE POLICY "Team members can view community events"
  ON public.events
  FOR SELECT
  TO authenticated
  USING (
    is_team_member_with_role(community_id, ARRAY['lecturer', 'assistant', 'guest_expert'])
  );

-- ============================================
-- 2. Homework Submissions - Team Member Grading
-- ============================================

-- Team members can view submissions in their community
CREATE POLICY "Team members can view community submissions"
  ON public.homework_submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM homework_assignments ha
      WHERE ha.id = assignment_id
        AND is_team_member_with_role(ha.community_id, ARRAY['lecturer', 'assistant'])
    )
  );

-- Team members can grade submissions (update)
CREATE POLICY "Team members can grade submissions"
  ON public.homework_submissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM homework_assignments ha
      WHERE ha.id = assignment_id
        AND is_team_member_with_role(ha.community_id, ARRAY['lecturer', 'assistant'])
    )
  );

-- ============================================
-- 3. Homework Assignments - Team Member View
-- ============================================

-- Team members can view all assignments in their community (including unpublished)
CREATE POLICY "Team members can view community assignments"
  ON public.homework_assignments
  FOR SELECT
  TO authenticated
  USING (
    is_team_member_with_role(community_id, ARRAY['lecturer', 'assistant'])
  );

-- ============================================
-- 4. Points - Team Member Award Access
-- ============================================

-- Team members can view point transactions in their community
CREATE POLICY "Team members can view community point transactions"
  ON public.point_transactions
  FOR SELECT
  TO authenticated
  USING (
    is_team_member_with_role(community_id, ARRAY['lecturer', 'assistant', 'guest_expert'])
  );

-- Team members can award points (insert transactions)
CREATE POLICY "Team members can award points"
  ON public.point_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_team_member_with_role(community_id, ARRAY['lecturer', 'assistant'])
  );

-- Team members can view points in their community
CREATE POLICY "Team members can view community points"
  ON public.points
  FOR SELECT
  TO authenticated
  USING (
    is_team_member_with_role(community_id, ARRAY['lecturer', 'assistant', 'guest_expert'])
  );

-- Team members can update points (for awarding bonus points)
CREATE POLICY "Team members can update community points"
  ON public.points
  FOR UPDATE
  TO authenticated
  USING (
    is_team_member_with_role(community_id, ARRAY['lecturer', 'assistant'])
  );

-- ============================================
-- 5. Memberships - Team Member View Access
-- ============================================

-- Team members can view memberships in their community
CREATE POLICY "Team members can view community memberships"
  ON public.memberships
  FOR SELECT
  TO authenticated
  USING (
    is_team_member_with_role(community_id, ARRAY['lecturer', 'assistant', 'guest_expert'])
  );

-- ============================================
-- 6. Profiles - Team Member View Access
-- ============================================

-- Team members can view profiles of members in their community
-- This allows them to see student names, avatars, etc.
CREATE POLICY "Team members can view community member profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN community_team_members ctm ON ctm.community_id = m.community_id
      WHERE m.user_id = profiles.id
        AND ctm.profile_id = get_my_profile_id()
        AND ctm.invite_status = 'accepted'
        AND ctm.role IN ('lecturer', 'assistant', 'guest_expert')
    )
  );

-- ============================================
-- 7. Event Attendees - Team Member Access
-- ============================================

-- Team members can view attendees for events in their community
CREATE POLICY "Team members can view community event attendees"
  ON public.event_attendees
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_id
        AND is_team_member_with_role(e.community_id, ARRAY['lecturer', 'assistant', 'guest_expert'])
    )
  );

-- Team members can manage attendees for their own events
CREATE POLICY "Team members can manage own event attendees"
  ON public.event_attendees
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_id
        AND e.creator_id = get_my_profile_id()
        AND is_team_member_with_role(e.community_id, ARRAY['lecturer', 'assistant'])
    )
  );

-- ============================================
-- Summary of New Permissions
-- ============================================
--
-- Lecturers & Assistants can:
-- ✅ Create calendar events in their community
-- ✅ Update/delete events they created
-- ✅ View and grade homework submissions
-- ✅ Award bonus points to students
-- ✅ View community members and their profiles
-- ✅ View event attendees
--
-- Guest Experts can:
-- ✅ View calendar events
-- ✅ View community members (read-only)
-- ✅ View point transactions (read-only)
--
-- All team members:
-- ✅ View community events
-- ✅ View memberships
