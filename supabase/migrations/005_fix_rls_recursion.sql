-- ============================================================================
-- FIX RLS INFINITE RECURSION (42P17)
-- ============================================================================
-- This migration fixes the infinite recursion in RLS policies by:
-- 1. Dropping problematic recursive policies
-- 2. Creating simpler, non-recursive policies
-- ============================================================================

-- ============================================================================
-- FIX: memberships table
-- The policy "Users can view memberships in their communities" was querying
-- memberships table from within a memberships policy = infinite recursion
-- ============================================================================

DROP POLICY IF EXISTS "Users can view memberships in their communities" ON public.memberships;
DROP POLICY IF EXISTS "Users can view own membership" ON public.memberships;

-- Replace with simpler policy: users can view all memberships in communities they're part of
-- by checking against communities table instead of self-referencing memberships
CREATE POLICY "Users can view memberships in their communities"
  ON public.memberships FOR SELECT
  USING (
    -- User can see their own membership
    user_id = auth.uid()
    OR
    -- User can see memberships in communities they created
    community_id IN (
      SELECT id FROM public.communities WHERE creator_id = auth.uid()
    )
  );

-- ============================================================================
-- FIX: communities table - add policy for creators to always see their own
-- ============================================================================

-- Already exists: "Creators can manage own communities"
-- Already exists: "Members can view their communities" - this one queries memberships

DROP POLICY IF EXISTS "Members can view their communities" ON public.communities;
DROP POLICY IF EXISTS "Authenticated users can view communities" ON public.communities;

-- Simpler approach: authenticated users can view public communities or ones they created
-- Membership check will happen at application level for private communities
CREATE POLICY "Authenticated users can view communities"
  ON public.communities FOR SELECT
  USING (
    -- Creator can always see their communities
    creator_id = auth.uid()
    OR
    -- Public communities visible to all
    is_public = true
  );

-- ============================================================================
-- FIX: community_channels - avoid querying memberships
-- ============================================================================

DROP POLICY IF EXISTS "Members can view channels in their communities" ON public.community_channels;
DROP POLICY IF EXISTS "Users can view channels" ON public.community_channels;

CREATE POLICY "Users can view channels"
  ON public.community_channels FOR SELECT
  USING (
    -- Channels in communities user created
    community_id IN (
      SELECT id FROM public.communities WHERE creator_id = auth.uid()
    )
    OR
    -- Channels in public communities
    community_id IN (
      SELECT id FROM public.communities WHERE is_public = true
    )
  );

-- ============================================================================
-- FIX: posts - simplify to avoid deep joins through memberships
-- ============================================================================

DROP POLICY IF EXISTS "Members can view posts in accessible channels" ON public.posts;
DROP POLICY IF EXISTS "Members can create posts in accessible channels" ON public.posts;
DROP POLICY IF EXISTS "Users can view posts" ON public.posts;
DROP POLICY IF EXISTS "Users can create posts" ON public.posts;

-- Simplified: posts visible if user created the community or it's public
CREATE POLICY "Users can view posts"
  ON public.posts FOR SELECT
  USING (
    channel_id IN (
      SELECT cc.id FROM public.community_channels cc
      JOIN public.communities c ON c.id = cc.community_id
      WHERE c.creator_id = auth.uid() OR c.is_public = true
    )
  );

CREATE POLICY "Users can create posts"
  ON public.posts FOR INSERT
  WITH CHECK (
    author_id = auth.uid() AND
    channel_id IN (
      SELECT cc.id FROM public.community_channels cc
      JOIN public.communities c ON c.id = cc.community_id
      WHERE c.creator_id = auth.uid() OR c.is_public = true
    )
  );

-- ============================================================================
-- FIX: post_comments - simplify
-- ============================================================================

DROP POLICY IF EXISTS "Users can view comments on accessible posts" ON public.post_comments;
DROP POLICY IF EXISTS "Users can create comments on accessible posts" ON public.post_comments;
DROP POLICY IF EXISTS "Users can view comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can create comments" ON public.post_comments;

CREATE POLICY "Users can view comments"
  ON public.post_comments FOR SELECT
  USING (
    post_id IN (
      SELECT p.id FROM public.posts p
      JOIN public.community_channels cc ON cc.id = p.channel_id
      JOIN public.communities c ON c.id = cc.community_id
      WHERE c.creator_id = auth.uid() OR c.is_public = true
    )
  );

CREATE POLICY "Users can create comments"
  ON public.post_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid() AND
    post_id IN (
      SELECT p.id FROM public.posts p
      JOIN public.community_channels cc ON cc.id = p.channel_id
      JOIN public.communities c ON c.id = cc.community_id
      WHERE c.creator_id = auth.uid() OR c.is_public = true
    )
  );

-- ============================================================================
-- FIX: post_likes - simplify
-- ============================================================================

DROP POLICY IF EXISTS "Users can view likes on accessible posts" ON public.post_likes;
DROP POLICY IF EXISTS "Users can like accessible posts" ON public.post_likes;
DROP POLICY IF EXISTS "Users can view likes" ON public.post_likes;
DROP POLICY IF EXISTS "Users can like posts" ON public.post_likes;

CREATE POLICY "Users can view likes"
  ON public.post_likes FOR SELECT
  USING (
    post_id IN (
      SELECT p.id FROM public.posts p
      JOIN public.community_channels cc ON cc.id = p.channel_id
      JOIN public.communities c ON c.id = cc.community_id
      WHERE c.creator_id = auth.uid() OR c.is_public = true
    )
  );

CREATE POLICY "Users can like posts"
  ON public.post_likes FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    post_id IN (
      SELECT p.id FROM public.posts p
      JOIN public.community_channels cc ON cc.id = p.channel_id
      JOIN public.communities c ON c.id = cc.community_id
      WHERE c.creator_id = auth.uid() OR c.is_public = true
    )
  );

-- ============================================================================
-- FIX: courses - avoid memberships query
-- ============================================================================

DROP POLICY IF EXISTS "Published courses visible to community members" ON public.courses;
DROP POLICY IF EXISTS "Published courses visible" ON public.courses;

-- Simplify: published courses in public communities or standalone are visible
CREATE POLICY "Published courses visible"
  ON public.courses FOR SELECT
  USING (
    is_published = true AND (
      community_id IS NULL
      OR community_id IN (SELECT id FROM public.communities WHERE is_public = true)
      OR community_id IN (SELECT id FROM public.communities WHERE creator_id = auth.uid())
    )
  );

-- ============================================================================
-- FIX: modules - simplify course access check
-- ============================================================================

DROP POLICY IF EXISTS "Users can view modules in accessible courses" ON public.modules;
DROP POLICY IF EXISTS "Users can view modules" ON public.modules;

CREATE POLICY "Users can view modules"
  ON public.modules FOR SELECT
  USING (
    course_id IN (
      SELECT id FROM public.courses
      WHERE creator_id = auth.uid()
        OR id IN (SELECT course_id FROM public.enrollments WHERE user_id = auth.uid())
        OR (is_published = true)
    )
  );

-- ============================================================================
-- FIX: lessons - simplify
-- ============================================================================

DROP POLICY IF EXISTS "Users can view lessons in accessible modules" ON public.lessons;
DROP POLICY IF EXISTS "Users can view lessons" ON public.lessons;

CREATE POLICY "Users can view lessons"
  ON public.lessons FOR SELECT
  USING (
    module_id IN (
      SELECT m.id FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE c.creator_id = auth.uid()
        OR c.id IN (SELECT course_id FROM public.enrollments WHERE user_id = auth.uid())
        OR c.is_published = true
    )
  );

-- ============================================================================
-- FIX: enrollments - avoid recursion
-- ============================================================================

DROP POLICY IF EXISTS "Students can view own enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Creators can view enrollments in own courses" ON public.enrollments;
DROP POLICY IF EXISTS "Users can view own enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Creators can view course enrollments" ON public.enrollments;

CREATE POLICY "Users can view own enrollments"
  ON public.enrollments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Creators can view course enrollments"
  ON public.enrollments FOR SELECT
  USING (
    course_id IN (
      SELECT id FROM public.courses WHERE creator_id = auth.uid()
    )
  );

-- ============================================================================
-- FIX: lesson_progress - simplify
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own progress" ON public.lesson_progress;
DROP POLICY IF EXISTS "Creators can view progress in own courses" ON public.lesson_progress;
DROP POLICY IF EXISTS "Creators can view student progress" ON public.lesson_progress;

CREATE POLICY "Users can view own progress"
  ON public.lesson_progress FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Creators can view student progress"
  ON public.lesson_progress FOR SELECT
  USING (
    lesson_id IN (
      SELECT l.id FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.courses c ON c.id = m.course_id
      WHERE c.creator_id = auth.uid()
    )
  );

-- ============================================================================
-- FIX: events - simplify community check
-- ============================================================================

DROP POLICY IF EXISTS "Members can view events in their communities" ON public.events;
DROP POLICY IF EXISTS "Users can view events" ON public.events;

CREATE POLICY "Users can view events"
  ON public.events FOR SELECT
  USING (
    creator_id = auth.uid()
    OR community_id IS NULL
    OR community_id IN (SELECT id FROM public.communities WHERE is_public = true)
    OR community_id IN (SELECT id FROM public.communities WHERE creator_id = auth.uid())
  );

-- ============================================================================
-- FIX: event_attendees - simplify
-- ============================================================================

DROP POLICY IF EXISTS "Users can view attendees for accessible events" ON public.event_attendees;
DROP POLICY IF EXISTS "Users can view event attendees" ON public.event_attendees;

CREATE POLICY "Users can view event attendees"
  ON public.event_attendees FOR SELECT
  USING (
    user_id = auth.uid()
    OR event_id IN (
      SELECT id FROM public.events WHERE creator_id = auth.uid()
    )
  );

-- ============================================================================
-- FIX: points - simplify community check
-- ============================================================================

DROP POLICY IF EXISTS "Users can view points in communities they belong to" ON public.points;
DROP POLICY IF EXISTS "Users can view points" ON public.points;

CREATE POLICY "Users can view points"
  ON public.points FOR SELECT
  USING (
    user_id = auth.uid()
    OR community_id IN (SELECT id FROM public.communities WHERE creator_id = auth.uid())
    OR community_id IN (SELECT id FROM public.communities WHERE is_public = true)
  );

-- ============================================================================
-- FIX: point_transactions - simplify
-- ============================================================================

DROP POLICY IF EXISTS "Users can view point transactions in communities they belong to" ON public.point_transactions;
DROP POLICY IF EXISTS "Users can view point transactions" ON public.point_transactions;

CREATE POLICY "Users can view point transactions"
  ON public.point_transactions FOR SELECT
  USING (
    user_id = auth.uid()
    OR community_id IN (SELECT id FROM public.communities WHERE creator_id = auth.uid())
  );

-- ============================================================================
-- FIX: student_health - simplify
-- ============================================================================

DROP POLICY IF EXISTS "Creators can view student health for their courses" ON public.student_health;
DROP POLICY IF EXISTS "Creators can view student health" ON public.student_health;

CREATE POLICY "Creators can view student health"
  ON public.student_health FOR SELECT
  USING (
    course_id IN (
      SELECT id FROM public.courses WHERE creator_id = auth.uid()
    )
  );

-- ============================================================================
-- DONE - All recursive policies fixed
-- ============================================================================
