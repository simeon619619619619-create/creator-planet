BEGIN;

-- ============================================================================
-- Admin Dashboard: Superadmin RLS policies
-- Adds is_superadmin() helper + SELECT policies for platform-wide queries
-- ============================================================================

-- Add is_admin column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Set platform admin
UPDATE public.profiles SET is_admin = true WHERE id = '9b258fa9-3dcb-4d04-8e2b-dc86a2b63279';

-- Helper function for cleaner policy definitions
-- Checks profiles.is_admin instead of JWT role for reliability
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE user_id = auth.uid()),
    false
  );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;

-- ============================================================================
-- SELECT policies for tables needing superadmin access
-- ============================================================================

-- Enrollments (enrollment counts/trends)
DROP POLICY IF EXISTS "Superadmins can view all enrollments" ON public.enrollments;
CREATE POLICY "Superadmins can view all enrollments"
  ON public.enrollments FOR SELECT
  TO authenticated
  USING (is_superadmin());

-- Courses (all courses, not just published)
DROP POLICY IF EXISTS "Superadmins can view all courses" ON public.courses;
CREATE POLICY "Superadmins can view all courses"
  ON public.courses FOR SELECT
  TO authenticated
  USING (is_superadmin());

-- Student health (at-risk tracking)
DROP POLICY IF EXISTS "Superadmins can view all student health" ON public.student_health;
CREATE POLICY "Superadmins can view all student health"
  ON public.student_health FOR SELECT
  TO authenticated
  USING (is_superadmin());

-- Events
DROP POLICY IF EXISTS "Superadmins can view all events" ON public.events;
CREATE POLICY "Superadmins can view all events"
  ON public.events FOR SELECT
  TO authenticated
  USING (is_superadmin());

-- Event attendees
DROP POLICY IF EXISTS "Superadmins can view all event attendees" ON public.event_attendees;
CREATE POLICY "Superadmins can view all event attendees"
  ON public.event_attendees FOR SELECT
  TO authenticated
  USING (is_superadmin());

-- Posts (post counts across platform)
DROP POLICY IF EXISTS "Superadmins can view all posts" ON public.posts;
CREATE POLICY "Superadmins can view all posts"
  ON public.posts FOR SELECT
  TO authenticated
  USING (is_superadmin());

-- Points (engagement metrics)
DROP POLICY IF EXISTS "Superadmins can view all points" ON public.points;
CREATE POLICY "Superadmins can view all points"
  ON public.points FOR SELECT
  TO authenticated
  USING (is_superadmin());

-- Lesson progress (completion tracking)
DROP POLICY IF EXISTS "Superadmins can view all lesson progress" ON public.lesson_progress;
CREATE POLICY "Superadmins can view all lesson progress"
  ON public.lesson_progress FOR SELECT
  TO authenticated
  USING (is_superadmin());

COMMIT;
