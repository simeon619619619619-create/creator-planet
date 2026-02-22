-- ============================================================================
-- COMPLETE RLS FIX - Remove ALL recursive policies
-- ============================================================================
-- This migration completely removes all potentially recursive policies
-- and replaces them with simple, non-recursive alternatives
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP ALL potentially problematic policies from courses table
-- ============================================================================
DROP POLICY IF EXISTS "Creators can manage own courses" ON public.courses;
DROP POLICY IF EXISTS "Students can view enrolled courses" ON public.courses;
DROP POLICY IF EXISTS "Published courses visible to community members" ON public.courses;
DROP POLICY IF EXISTS "Published standalone courses discoverable" ON public.courses;
DROP POLICY IF EXISTS "Published courses visible" ON public.courses;
DROP POLICY IF EXISTS "Anyone can view published courses" ON public.courses;

-- Simple courses policies - no recursion
CREATE POLICY "Creators can manage own courses"
  ON public.courses FOR ALL
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- Users can view published courses (simple check)
CREATE POLICY "Anyone can view published courses"
  ON public.courses FOR SELECT
  USING (is_published = true);

-- ============================================================================
-- STEP 2: DROP ALL potentially problematic policies from enrollments table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Creators can view enrollments in own courses" ON public.enrollments;
DROP POLICY IF EXISTS "Creators can view course enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Users can enroll in courses" ON public.enrollments;
DROP POLICY IF EXISTS "Users can update own enrollments" ON public.enrollments;

-- Simple enrollments policies
CREATE POLICY "Users can view own enrollments"
  ON public.enrollments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Creators can view course enrollments"
  ON public.enrollments FOR SELECT
  USING (
    course_id IN (SELECT id FROM public.courses WHERE creator_id = auth.uid())
  );

CREATE POLICY "Users can enroll in courses"
  ON public.enrollments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own enrollments"
  ON public.enrollments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- STEP 3: DROP ALL potentially problematic policies from modules table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view modules in accessible courses" ON public.modules;
DROP POLICY IF EXISTS "Users can view modules" ON public.modules;
DROP POLICY IF EXISTS "Creators can manage modules in own courses" ON public.modules;
DROP POLICY IF EXISTS "Users can view modules in published courses" ON public.modules;

-- Simple modules policies
CREATE POLICY "Creators can manage modules in own courses"
  ON public.modules FOR ALL
  USING (course_id IN (SELECT id FROM public.courses WHERE creator_id = auth.uid()))
  WITH CHECK (course_id IN (SELECT id FROM public.courses WHERE creator_id = auth.uid()));

CREATE POLICY "Users can view modules in published courses"
  ON public.modules FOR SELECT
  USING (course_id IN (SELECT id FROM public.courses WHERE is_published = true));

-- ============================================================================
-- STEP 4: DROP ALL potentially problematic policies from lessons table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view lessons in accessible modules" ON public.lessons;
DROP POLICY IF EXISTS "Users can view lessons" ON public.lessons;
DROP POLICY IF EXISTS "Creators can manage lessons in own courses" ON public.lessons;
DROP POLICY IF EXISTS "Users can view lessons in published courses" ON public.lessons;

-- Simple lessons policies
CREATE POLICY "Creators can manage lessons in own courses"
  ON public.lessons FOR ALL
  USING (
    module_id IN (
      SELECT m.id FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE c.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    module_id IN (
      SELECT m.id FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE c.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can view lessons in published courses"
  ON public.lessons FOR SELECT
  USING (
    module_id IN (
      SELECT m.id FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE c.is_published = true
    )
  );

-- ============================================================================
-- STEP 5: DROP ALL potentially problematic policies from lesson_progress table
-- ============================================================================
DROP POLICY IF EXISTS "Users can manage own lesson progress" ON public.lesson_progress;
DROP POLICY IF EXISTS "Users can view own progress" ON public.lesson_progress;
DROP POLICY IF EXISTS "Creators can view progress in own courses" ON public.lesson_progress;
DROP POLICY IF EXISTS "Creators can view student progress" ON public.lesson_progress;

-- Simple lesson_progress policies
CREATE POLICY "Users can manage own lesson progress"
  ON public.lesson_progress FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

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
-- STEP 6: DROP ALL potentially problematic policies from student_health table
-- ============================================================================
DROP POLICY IF EXISTS "Creators can view student health in own courses" ON public.student_health;
DROP POLICY IF EXISTS "Creators can view student health for their courses" ON public.student_health;
DROP POLICY IF EXISTS "Creators can view student health" ON public.student_health;
DROP POLICY IF EXISTS "System can manage student health" ON public.student_health;

-- Simple student_health policies
CREATE POLICY "Creators can view student health"
  ON public.student_health FOR SELECT
  USING (
    course_id IN (SELECT id FROM public.courses WHERE creator_id = auth.uid())
  );

CREATE POLICY "System can manage student health"
  ON public.student_health FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 7: Fix memberships - this was the root cause
-- ============================================================================
DROP POLICY IF EXISTS "Users can view memberships in their communities" ON public.memberships;
DROP POLICY IF EXISTS "Users can view own membership" ON public.memberships;
DROP POLICY IF EXISTS "Members can view other members" ON public.memberships;
DROP POLICY IF EXISTS "Creators can view community memberships" ON public.memberships;

-- Simple memberships policies
CREATE POLICY "Users can view own membership"
  ON public.memberships FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Creators can view community memberships"
  ON public.memberships FOR SELECT
  USING (
    community_id IN (SELECT id FROM public.communities WHERE creator_id = auth.uid())
  );

-- ============================================================================
-- STEP 8: Fix communities table
-- ============================================================================
DROP POLICY IF EXISTS "Creators can manage own communities" ON public.communities;
DROP POLICY IF EXISTS "Members can view their communities" ON public.communities;
DROP POLICY IF EXISTS "Authenticated users can view communities" ON public.communities;
DROP POLICY IF EXISTS "Users can view public communities" ON public.communities;

-- Simple communities policies
CREATE POLICY "Creators can manage own communities"
  ON public.communities FOR ALL
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Users can view public communities"
  ON public.communities FOR SELECT
  USING (is_public = true);

-- ============================================================================
-- STEP 9: Fix community_channels
-- ============================================================================
DROP POLICY IF EXISTS "Members can view channels in their communities" ON public.community_channels;
DROP POLICY IF EXISTS "Users can view channels" ON public.community_channels;
DROP POLICY IF EXISTS "Creators can manage channels" ON public.community_channels;
DROP POLICY IF EXISTS "Users can view channels in public communities" ON public.community_channels;

-- Simple channel policies
CREATE POLICY "Creators can manage channels"
  ON public.community_channels FOR ALL
  USING (community_id IN (SELECT id FROM public.communities WHERE creator_id = auth.uid()))
  WITH CHECK (community_id IN (SELECT id FROM public.communities WHERE creator_id = auth.uid()));

CREATE POLICY "Users can view channels in public communities"
  ON public.community_channels FOR SELECT
  USING (community_id IN (SELECT id FROM public.communities WHERE is_public = true));

-- ============================================================================
-- STEP 10: Fix posts
-- ============================================================================
DROP POLICY IF EXISTS "Members can view posts in accessible channels" ON public.posts;
DROP POLICY IF EXISTS "Members can create posts in accessible channels" ON public.posts;
DROP POLICY IF EXISTS "Users can view posts" ON public.posts;
DROP POLICY IF EXISTS "Users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Authors can manage own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can view posts in public communities" ON public.posts;
DROP POLICY IF EXISTS "Users can create posts in their communities" ON public.posts;

-- Simple post policies
CREATE POLICY "Authors can manage own posts"
  ON public.posts FOR ALL
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Users can view posts in public communities"
  ON public.posts FOR SELECT
  USING (
    channel_id IN (
      SELECT cc.id FROM public.community_channels cc
      JOIN public.communities c ON c.id = cc.community_id
      WHERE c.is_public = true OR c.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can create posts in their communities"
  ON public.posts FOR INSERT
  WITH CHECK (
    author_id = auth.uid() AND
    channel_id IN (
      SELECT cc.id FROM public.community_channels cc
      JOIN public.communities c ON c.id = cc.community_id
      WHERE c.is_public = true OR c.creator_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 11: Fix post_comments
-- ============================================================================
DROP POLICY IF EXISTS "Users can view comments on accessible posts" ON public.post_comments;
DROP POLICY IF EXISTS "Users can create comments on accessible posts" ON public.post_comments;
DROP POLICY IF EXISTS "Users can view comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can create comments" ON public.post_comments;
DROP POLICY IF EXISTS "Authors can manage own comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can view all comments" ON public.post_comments;

-- Simple comment policies
CREATE POLICY "Authors can manage own comments"
  ON public.post_comments FOR ALL
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Users can view all comments"
  ON public.post_comments FOR SELECT
  USING (true);

-- ============================================================================
-- STEP 12: Fix post_likes
-- ============================================================================
DROP POLICY IF EXISTS "Users can view likes on accessible posts" ON public.post_likes;
DROP POLICY IF EXISTS "Users can like accessible posts" ON public.post_likes;
DROP POLICY IF EXISTS "Users can view likes" ON public.post_likes;
DROP POLICY IF EXISTS "Users can like posts" ON public.post_likes;
DROP POLICY IF EXISTS "Users can manage own likes" ON public.post_likes;
DROP POLICY IF EXISTS "Users can view all likes" ON public.post_likes;

-- Simple like policies
CREATE POLICY "Users can manage own likes"
  ON public.post_likes FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view all likes"
  ON public.post_likes FOR SELECT
  USING (true);

-- ============================================================================
-- STEP 13: Fix events
-- ============================================================================
DROP POLICY IF EXISTS "Creators can manage own events" ON public.events;
DROP POLICY IF EXISTS "Members can view events in their communities" ON public.events;
DROP POLICY IF EXISTS "Users can view events" ON public.events;
DROP POLICY IF EXISTS "Users can view public events" ON public.events;

-- Simple event policies
CREATE POLICY "Creators can manage own events"
  ON public.events FOR ALL
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Users can view public events"
  ON public.events FOR SELECT
  USING (
    community_id IS NULL
    OR community_id IN (SELECT id FROM public.communities WHERE is_public = true)
    OR creator_id = auth.uid()
  );

-- ============================================================================
-- STEP 14: Fix event_attendees
-- ============================================================================
DROP POLICY IF EXISTS "Users can view attendees for accessible events" ON public.event_attendees;
DROP POLICY IF EXISTS "Users can view event attendees" ON public.event_attendees;
DROP POLICY IF EXISTS "Users can RSVP to events" ON public.event_attendees;
DROP POLICY IF EXISTS "Users can manage own attendance" ON public.event_attendees;
DROP POLICY IF EXISTS "Creators can view event attendees" ON public.event_attendees;

-- Simple attendee policies
CREATE POLICY "Users can manage own attendance"
  ON public.event_attendees FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Creators can view event attendees"
  ON public.event_attendees FOR SELECT
  USING (event_id IN (SELECT id FROM public.events WHERE creator_id = auth.uid()));

-- ============================================================================
-- STEP 15: Fix points
-- ============================================================================
DROP POLICY IF EXISTS "Users can view points in communities they belong to" ON public.points;
DROP POLICY IF EXISTS "Users can view points" ON public.points;
DROP POLICY IF EXISTS "Users can view own points" ON public.points;
DROP POLICY IF EXISTS "Creators can view community points" ON public.points;
DROP POLICY IF EXISTS "System can manage points" ON public.points;

-- Simple points policies
CREATE POLICY "Users can view own points"
  ON public.points FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Creators can view community points"
  ON public.points FOR SELECT
  USING (community_id IN (SELECT id FROM public.communities WHERE creator_id = auth.uid()));

CREATE POLICY "System can manage points"
  ON public.points FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 16: Fix point_transactions
-- ============================================================================
DROP POLICY IF EXISTS "Users can view point transactions in communities they belong to" ON public.point_transactions;
DROP POLICY IF EXISTS "Users can view point transactions" ON public.point_transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.point_transactions;
DROP POLICY IF EXISTS "Creators can view community transactions" ON public.point_transactions;

-- Simple transaction policies
CREATE POLICY "Users can view own transactions"
  ON public.point_transactions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Creators can view community transactions"
  ON public.point_transactions FOR SELECT
  USING (community_id IN (SELECT id FROM public.communities WHERE creator_id = auth.uid()));

-- ============================================================================
-- STEP 17: Fix tasks
-- ============================================================================
DROP POLICY IF EXISTS "Creators can manage own tasks" ON public.tasks;

CREATE POLICY "Creators can manage own tasks"
  ON public.tasks FOR ALL
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- ============================================================================
-- DONE - All policies simplified to avoid recursion
-- ============================================================================
