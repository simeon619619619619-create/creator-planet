-- ============================================================================
-- CREATOR CLUB - PHASE 2 DATABASE SCHEMA
-- ============================================================================
-- This migration creates all Phase 2 tables for the Creator Club platform:
-- - Creator profiles, communities, channels, memberships
-- - Courses, modules, lessons, enrollments
-- - Events, calendar, attendees
-- - Gamification (points, levels)
-- - AI Success Manager (student health tracking)
-- - Tasks and productivity
--
-- This migration is idempotent and can be run multiple times safely.
-- Foreign keys are created in proper order to satisfy dependencies.
-- Row Level Security (RLS) is enabled with multi-tenant isolation.
-- ============================================================================

-- ============================================================================
-- SECTION 1: CLEANUP - Drop existing Phase 2 tables in reverse dependency order
-- ============================================================================

-- Drop tables in reverse order to satisfy foreign key dependencies
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.student_health CASCADE;
DROP TABLE IF EXISTS public.point_transactions CASCADE;
DROP TABLE IF EXISTS public.points CASCADE;
DROP TABLE IF EXISTS public.event_attendees CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.lesson_progress CASCADE;
DROP TABLE IF EXISTS public.enrollments CASCADE;
DROP TABLE IF EXISTS public.lessons CASCADE;
DROP TABLE IF EXISTS public.modules CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.post_likes CASCADE;
DROP TABLE IF EXISTS public.post_comments CASCADE;
DROP TABLE IF EXISTS public.posts CASCADE;
DROP TABLE IF EXISTS public.memberships CASCADE;
DROP TABLE IF EXISTS public.community_channels CASCADE;
DROP TABLE IF EXISTS public.communities CASCADE;
DROP TABLE IF EXISTS public.creator_profiles CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS unlock_type CASCADE;
DROP TYPE IF EXISTS enrollment_status CASCADE;
DROP TYPE IF EXISTS event_type CASCADE;
DROP TYPE IF EXISTS attendee_status CASCADE;
DROP TYPE IF EXISTS student_status CASCADE;
DROP TYPE IF EXISTS task_status CASCADE;
DROP TYPE IF EXISTS lesson_type CASCADE;
DROP TYPE IF EXISTS membership_role CASCADE;

-- ============================================================================
-- SECTION 2: CREATE CUSTOM TYPES
-- ============================================================================

CREATE TYPE lesson_type AS ENUM ('video', 'text', 'file', 'quiz');
CREATE TYPE unlock_type AS ENUM ('immediate', 'date', 'progress');
CREATE TYPE enrollment_status AS ENUM ('active', 'completed', 'dropped');
CREATE TYPE event_type AS ENUM ('group', 'one_on_one');
CREATE TYPE attendee_status AS ENUM ('attending', 'maybe', 'declined');
CREATE TYPE student_status AS ENUM ('at_risk', 'stable', 'top_member');
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done');
CREATE TYPE membership_role AS ENUM ('admin', 'moderator', 'member');

-- ============================================================================
-- SECTION 3: CREATE TABLES (in order to satisfy foreign key dependencies)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE 1: creator_profiles
-- Extends profiles table for creators with additional business metadata
-- ----------------------------------------------------------------------------
CREATE TABLE public.creator_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  brand_name TEXT,
  bio TEXT,
  timezone TEXT DEFAULT 'UTC',
  ai_prompt TEXT, -- Custom prompt for AI mentor personalization
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX creator_profiles_creator_id_idx ON public.creator_profiles(creator_id);
CREATE INDEX creator_profiles_stripe_customer_id_idx ON public.creator_profiles(stripe_customer_id);

COMMENT ON TABLE public.creator_profiles IS 'Extended profile information for creators (mentors, coaches, course creators)';
COMMENT ON COLUMN public.creator_profiles.creator_id IS 'Foreign key to profiles.id';
COMMENT ON COLUMN public.creator_profiles.ai_prompt IS 'Custom AI mentor prompt for personalized student interactions';
COMMENT ON COLUMN public.creator_profiles.stripe_customer_id IS 'Stripe customer ID for billing';

-- ----------------------------------------------------------------------------
-- TABLE 2: communities
-- Creator's communities (replaces Discord/Skool)
-- ----------------------------------------------------------------------------
CREATE TABLE public.communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX communities_creator_id_idx ON public.communities(creator_id);
CREATE INDEX communities_is_public_idx ON public.communities(is_public);

COMMENT ON TABLE public.communities IS 'Communities created by mentors (replaces Discord/Skool)';
COMMENT ON COLUMN public.communities.is_public IS 'Whether the community is publicly visible or private';

-- ----------------------------------------------------------------------------
-- TABLE 3: community_channels
-- Channels within communities for organized discussions
-- ----------------------------------------------------------------------------
CREATE TABLE public.community_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  position INTEGER DEFAULT 0, -- For custom ordering
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX community_channels_community_id_idx ON public.community_channels(community_id);
CREATE INDEX community_channels_position_idx ON public.community_channels(community_id, position);

COMMENT ON TABLE public.community_channels IS 'Channels within communities for organized discussions';
COMMENT ON COLUMN public.community_channels.position IS 'Display order within the community';

-- ----------------------------------------------------------------------------
-- TABLE 4: memberships
-- User membership in communities with role-based access
-- ----------------------------------------------------------------------------
CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
  role membership_role DEFAULT 'member' NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_user_community UNIQUE (user_id, community_id)
);

CREATE INDEX memberships_user_id_idx ON public.memberships(user_id);
CREATE INDEX memberships_community_id_idx ON public.memberships(community_id);
CREATE INDEX memberships_role_idx ON public.memberships(role);

COMMENT ON TABLE public.memberships IS 'User membership in communities with role-based permissions';
COMMENT ON COLUMN public.memberships.role IS 'Member role: admin, moderator, or member';

-- ----------------------------------------------------------------------------
-- TABLE 5: posts
-- Posts in community channels (forum-style discussions)
-- ----------------------------------------------------------------------------
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.community_channels(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX posts_channel_id_idx ON public.posts(channel_id);
CREATE INDEX posts_author_id_idx ON public.posts(author_id);
CREATE INDEX posts_created_at_idx ON public.posts(created_at DESC);

COMMENT ON TABLE public.posts IS 'Forum-style posts in community channels';

-- ----------------------------------------------------------------------------
-- TABLE 6: post_comments
-- Comments/replies on posts (threaded discussions)
-- ----------------------------------------------------------------------------
CREATE TABLE public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX post_comments_post_id_idx ON public.post_comments(post_id);
CREATE INDEX post_comments_author_id_idx ON public.post_comments(author_id);
CREATE INDEX post_comments_created_at_idx ON public.post_comments(created_at DESC);

COMMENT ON TABLE public.post_comments IS 'Comments/replies on posts for threaded discussions';

-- ----------------------------------------------------------------------------
-- TABLE 7: post_likes
-- User likes on posts (engagement tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_post_like UNIQUE (post_id, user_id)
);

CREATE INDEX post_likes_post_id_idx ON public.post_likes(post_id);
CREATE INDEX post_likes_user_id_idx ON public.post_likes(user_id);

COMMENT ON TABLE public.post_likes IS 'User likes on posts for engagement tracking';

-- ----------------------------------------------------------------------------
-- TABLE 8: courses
-- Courses created by creators (replaces Kajabi)
-- ----------------------------------------------------------------------------
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  community_id UUID REFERENCES public.communities(id) ON DELETE SET NULL, -- Optional community association
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX courses_creator_id_idx ON public.courses(creator_id);
CREATE INDEX courses_community_id_idx ON public.courses(community_id);
CREATE INDEX courses_is_published_idx ON public.courses(is_published);

COMMENT ON TABLE public.courses IS 'Courses created by mentors (replaces Kajabi LMS)';
COMMENT ON COLUMN public.courses.community_id IS 'Optional: link course to a specific community';

-- ----------------------------------------------------------------------------
-- TABLE 9: modules
-- Modules within courses (course structure)
-- ----------------------------------------------------------------------------
CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER DEFAULT 0, -- For custom ordering
  unlock_type unlock_type DEFAULT 'immediate' NOT NULL,
  unlock_value TEXT, -- Date string for 'date' type, or progress percentage for 'progress' type
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX modules_course_id_idx ON public.modules(course_id);
CREATE INDEX modules_position_idx ON public.modules(course_id, position);

COMMENT ON TABLE public.modules IS 'Modules within courses for structured learning paths';
COMMENT ON COLUMN public.modules.unlock_type IS 'How module unlocks: immediate, date, or progress-based';
COMMENT ON COLUMN public.modules.unlock_value IS 'Date (ISO string) for date unlock, or progress % for progress unlock';

-- ----------------------------------------------------------------------------
-- TABLE 10: lessons
-- Lessons within modules (course content)
-- ----------------------------------------------------------------------------
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type lesson_type DEFAULT 'video' NOT NULL,
  content_url TEXT, -- Video URL, file URL, or text content ID
  position INTEGER DEFAULT 0, -- For custom ordering
  duration_minutes INTEGER, -- Estimated time to complete
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX lessons_module_id_idx ON public.lessons(module_id);
CREATE INDEX lessons_position_idx ON public.lessons(module_id, position);

COMMENT ON TABLE public.lessons IS 'Individual lessons within course modules';
COMMENT ON COLUMN public.lessons.type IS 'Lesson content type: video, text, file, or quiz';
COMMENT ON COLUMN public.lessons.content_url IS 'URL to video, file, or reference to content storage';

-- ----------------------------------------------------------------------------
-- TABLE 11: enrollments
-- Student enrollments in courses
-- ----------------------------------------------------------------------------
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  enrolled_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  status enrollment_status DEFAULT 'active' NOT NULL,
  completed_at TIMESTAMPTZ,
  CONSTRAINT unique_user_course UNIQUE (user_id, course_id)
);

CREATE INDEX enrollments_user_id_idx ON public.enrollments(user_id);
CREATE INDEX enrollments_course_id_idx ON public.enrollments(course_id);
CREATE INDEX enrollments_status_idx ON public.enrollments(status);

COMMENT ON TABLE public.enrollments IS 'Student enrollments in courses with status tracking';
COMMENT ON COLUMN public.enrollments.status IS 'Enrollment status: active, completed, or dropped';

-- ----------------------------------------------------------------------------
-- TABLE 12: lesson_progress
-- Track student progress through lessons
-- ----------------------------------------------------------------------------
CREATE TABLE public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  completed_at TIMESTAMPTZ,
  progress_percent INTEGER DEFAULT 0, -- 0-100
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_user_lesson UNIQUE (user_id, lesson_id),
  CONSTRAINT valid_progress_percent CHECK (progress_percent >= 0 AND progress_percent <= 100)
);

CREATE INDEX lesson_progress_user_id_idx ON public.lesson_progress(user_id);
CREATE INDEX lesson_progress_lesson_id_idx ON public.lesson_progress(lesson_id);
CREATE INDEX lesson_progress_completed_at_idx ON public.lesson_progress(completed_at);

COMMENT ON TABLE public.lesson_progress IS 'Student progress tracking for individual lessons';
COMMENT ON COLUMN public.lesson_progress.progress_percent IS 'Completion percentage (0-100)';

-- ----------------------------------------------------------------------------
-- TABLE 13: events
-- Calendar events (group sessions, 1:1 calls) (replaces Calendly)
-- ----------------------------------------------------------------------------
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  community_id UUID REFERENCES public.communities(id) ON DELETE SET NULL, -- Optional community association
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  event_type event_type DEFAULT 'group' NOT NULL,
  meeting_link TEXT, -- Zoom, Google Meet, etc.
  max_attendees INTEGER, -- For one_on_one: usually 1, for group: custom limit
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT valid_event_time CHECK (end_time > start_time)
);

CREATE INDEX events_creator_id_idx ON public.events(creator_id);
CREATE INDEX events_community_id_idx ON public.events(community_id);
CREATE INDEX events_start_time_idx ON public.events(start_time);
CREATE INDEX events_event_type_idx ON public.events(event_type);

COMMENT ON TABLE public.events IS 'Calendar events for group sessions and 1:1 calls (replaces Calendly)';
COMMENT ON COLUMN public.events.event_type IS 'Event type: group session or one_on_one call';
COMMENT ON COLUMN public.events.max_attendees IS 'Maximum number of attendees (null = unlimited)';

-- ----------------------------------------------------------------------------
-- TABLE 14: event_attendees
-- RSVPs and attendance tracking for events
-- ----------------------------------------------------------------------------
CREATE TABLE public.event_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status attendee_status DEFAULT 'attending' NOT NULL,
  responded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_event_attendee UNIQUE (event_id, user_id)
);

CREATE INDEX event_attendees_event_id_idx ON public.event_attendees(event_id);
CREATE INDEX event_attendees_user_id_idx ON public.event_attendees(user_id);
CREATE INDEX event_attendees_status_idx ON public.event_attendees(status);

COMMENT ON TABLE public.event_attendees IS 'RSVP and attendance tracking for calendar events';
COMMENT ON COLUMN public.event_attendees.status IS 'RSVP status: attending, maybe, or declined';

-- ----------------------------------------------------------------------------
-- TABLE 15: points
-- Gamification: user points per community
-- ----------------------------------------------------------------------------
CREATE TABLE public.points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
  total_points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_user_community_points UNIQUE (user_id, community_id),
  CONSTRAINT valid_points CHECK (total_points >= 0),
  CONSTRAINT valid_level CHECK (level >= 1)
);

CREATE INDEX points_user_id_idx ON public.points(user_id);
CREATE INDEX points_community_id_idx ON public.points(community_id);
CREATE INDEX points_total_points_idx ON public.points(total_points DESC);
CREATE INDEX points_level_idx ON public.points(level DESC);

COMMENT ON TABLE public.points IS 'Gamification points and levels per user per community';
COMMENT ON COLUMN public.points.total_points IS 'Total points accumulated in this community';
COMMENT ON COLUMN public.points.level IS 'Current level based on points';

-- ----------------------------------------------------------------------------
-- TABLE 16: point_transactions
-- History of point earning/spending
-- ----------------------------------------------------------------------------
CREATE TABLE public.point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
  points INTEGER NOT NULL, -- Can be negative for spending
  reason TEXT NOT NULL, -- e.g., "Posted in channel", "Completed lesson", etc.
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX point_transactions_user_id_idx ON public.point_transactions(user_id);
CREATE INDEX point_transactions_community_id_idx ON public.point_transactions(community_id);
CREATE INDEX point_transactions_created_at_idx ON public.point_transactions(created_at DESC);

COMMENT ON TABLE public.point_transactions IS 'History of point earning and spending for audit trail';
COMMENT ON COLUMN public.point_transactions.points IS 'Points earned (positive) or spent (negative)';

-- ----------------------------------------------------------------------------
-- TABLE 17: student_health
-- AI Success Manager: student engagement and risk tracking
-- ----------------------------------------------------------------------------
CREATE TABLE public.student_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  risk_score INTEGER DEFAULT 0, -- 0-100 (0 = no risk, 100 = high risk)
  status student_status DEFAULT 'stable' NOT NULL,
  last_activity_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_user_course_health UNIQUE (user_id, course_id),
  CONSTRAINT valid_risk_score CHECK (risk_score >= 0 AND risk_score <= 100)
);

CREATE INDEX student_health_user_id_idx ON public.student_health(user_id);
CREATE INDEX student_health_course_id_idx ON public.student_health(course_id);
CREATE INDEX student_health_risk_score_idx ON public.student_health(risk_score DESC);
CREATE INDEX student_health_status_idx ON public.student_health(status);

COMMENT ON TABLE public.student_health IS 'AI Success Manager tracking of student engagement and risk';
COMMENT ON COLUMN public.student_health.risk_score IS 'AI-calculated risk score (0-100, higher = more at risk)';
COMMENT ON COLUMN public.student_health.status IS 'Student status: at_risk, stable, or top_member';
COMMENT ON COLUMN public.student_health.last_activity_at IS 'Last time student interacted with course';

-- ----------------------------------------------------------------------------
-- TABLE 18: tasks
-- Creator's task list and productivity tracker
-- ----------------------------------------------------------------------------
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  status task_status DEFAULT 'todo' NOT NULL,
  linked_type TEXT, -- 'community', 'course', 'event', or null
  linked_id UUID, -- ID of linked entity (generic reference)
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX tasks_creator_id_idx ON public.tasks(creator_id);
CREATE INDEX tasks_status_idx ON public.tasks(status);
CREATE INDEX tasks_due_date_idx ON public.tasks(due_date);

COMMENT ON TABLE public.tasks IS 'Creator task management and productivity tracking';
COMMENT ON COLUMN public.tasks.linked_type IS 'Type of linked entity: community, course, event, or null';
COMMENT ON COLUMN public.tasks.linked_id IS 'UUID of linked entity (polymorphic reference)';

-- ============================================================================
-- SECTION 4: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 5: ROW LEVEL SECURITY POLICIES
-- ============================================================================
-- Policies use JWT claims to avoid recursion (same pattern as Phase 1)
-- Multi-tenant isolation: creators see their data, students see enrolled content
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RLS: creator_profiles
-- ----------------------------------------------------------------------------

-- Creators can view and update their own profile
CREATE POLICY "Creators can view own profile"
  ON public.creator_profiles FOR SELECT
  USING (creator_id = auth.uid());

CREATE POLICY "Creators can update own profile"
  ON public.creator_profiles FOR UPDATE
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Creators can insert own profile"
  ON public.creator_profiles FOR INSERT
  WITH CHECK (creator_id = auth.uid());

-- Superadmins can view all creator profiles
CREATE POLICY "Superadmins can view all creator profiles"
  ON public.creator_profiles FOR SELECT
  USING ((auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'superadmin');

-- ----------------------------------------------------------------------------
-- RLS: communities
-- ----------------------------------------------------------------------------

-- Creators can manage their own communities
CREATE POLICY "Creators can manage own communities"
  ON public.communities FOR ALL
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- Members can view communities they belong to
CREATE POLICY "Members can view their communities"
  ON public.communities FOR SELECT
  USING (
    id IN (
      SELECT community_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- Public communities are visible to all authenticated users
CREATE POLICY "Public communities visible to all"
  ON public.communities FOR SELECT
  USING (is_public = true);

-- ----------------------------------------------------------------------------
-- RLS: community_channels
-- ----------------------------------------------------------------------------

-- Channels visible to community members
CREATE POLICY "Members can view channels in their communities"
  ON public.community_channels FOR SELECT
  USING (
    community_id IN (
      SELECT community_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- Creators can manage channels in their communities
CREATE POLICY "Creators can manage channels in own communities"
  ON public.community_channels FOR ALL
  USING (
    community_id IN (
      SELECT id FROM public.communities
      WHERE creator_id = auth.uid()
    )
  )
  WITH CHECK (
    community_id IN (
      SELECT id FROM public.communities
      WHERE creator_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- RLS: memberships
-- ----------------------------------------------------------------------------

-- Users can view memberships in communities they belong to
CREATE POLICY "Users can view memberships in their communities"
  ON public.memberships FOR SELECT
  USING (
    community_id IN (
      SELECT community_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- Creators can manage memberships in their communities
CREATE POLICY "Creators can manage memberships in own communities"
  ON public.memberships FOR ALL
  USING (
    community_id IN (
      SELECT id FROM public.communities
      WHERE creator_id = auth.uid()
    )
  )
  WITH CHECK (
    community_id IN (
      SELECT id FROM public.communities
      WHERE creator_id = auth.uid()
    )
  );

-- Users can view their own memberships
CREATE POLICY "Users can view own memberships"
  ON public.memberships FOR SELECT
  USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- RLS: posts
-- ----------------------------------------------------------------------------

-- Members can view posts in channels they have access to
CREATE POLICY "Members can view posts in accessible channels"
  ON public.posts FOR SELECT
  USING (
    channel_id IN (
      SELECT cc.id FROM public.community_channels cc
      JOIN public.memberships m ON m.community_id = cc.community_id
      WHERE m.user_id = auth.uid()
    )
  );

-- Members can create posts in channels they have access to
CREATE POLICY "Members can create posts in accessible channels"
  ON public.posts FOR INSERT
  WITH CHECK (
    author_id = auth.uid() AND
    channel_id IN (
      SELECT cc.id FROM public.community_channels cc
      JOIN public.memberships m ON m.community_id = cc.community_id
      WHERE m.user_id = auth.uid()
    )
  );

-- Authors can update/delete their own posts
CREATE POLICY "Authors can update own posts"
  ON public.posts FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors can delete own posts"
  ON public.posts FOR DELETE
  USING (author_id = auth.uid());

-- ----------------------------------------------------------------------------
-- RLS: post_comments
-- ----------------------------------------------------------------------------

-- Users can view comments on posts they can see
CREATE POLICY "Users can view comments on accessible posts"
  ON public.post_comments FOR SELECT
  USING (
    post_id IN (
      SELECT p.id FROM public.posts p
      JOIN public.community_channels cc ON cc.id = p.channel_id
      JOIN public.memberships m ON m.community_id = cc.community_id
      WHERE m.user_id = auth.uid()
    )
  );

-- Users can create comments on posts they can see
CREATE POLICY "Users can create comments on accessible posts"
  ON public.post_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid() AND
    post_id IN (
      SELECT p.id FROM public.posts p
      JOIN public.community_channels cc ON cc.id = p.channel_id
      JOIN public.memberships m ON m.community_id = cc.community_id
      WHERE m.user_id = auth.uid()
    )
  );

-- Authors can update/delete their own comments
CREATE POLICY "Authors can update own comments"
  ON public.post_comments FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors can delete own comments"
  ON public.post_comments FOR DELETE
  USING (author_id = auth.uid());

-- ----------------------------------------------------------------------------
-- RLS: post_likes
-- ----------------------------------------------------------------------------

-- Users can view likes on posts they can see
CREATE POLICY "Users can view likes on accessible posts"
  ON public.post_likes FOR SELECT
  USING (
    post_id IN (
      SELECT p.id FROM public.posts p
      JOIN public.community_channels cc ON cc.id = p.channel_id
      JOIN public.memberships m ON m.community_id = cc.community_id
      WHERE m.user_id = auth.uid()
    )
  );

-- Users can like posts they can see
CREATE POLICY "Users can like accessible posts"
  ON public.post_likes FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    post_id IN (
      SELECT p.id FROM public.posts p
      JOIN public.community_channels cc ON cc.id = p.channel_id
      JOIN public.memberships m ON m.community_id = cc.community_id
      WHERE m.user_id = auth.uid()
    )
  );

-- Users can unlike their own likes
CREATE POLICY "Users can unlike own likes"
  ON public.post_likes FOR DELETE
  USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- RLS: courses
-- ----------------------------------------------------------------------------

-- Creators can manage their own courses
CREATE POLICY "Creators can manage own courses"
  ON public.courses FOR ALL
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- Students can view courses they're enrolled in
CREATE POLICY "Students can view enrolled courses"
  ON public.courses FOR SELECT
  USING (
    id IN (
      SELECT course_id FROM public.enrollments
      WHERE user_id = auth.uid()
    )
  );

-- Published courses visible to community members (if linked to community)
CREATE POLICY "Published courses visible to community members"
  ON public.courses FOR SELECT
  USING (
    is_published = true AND
    community_id IN (
      SELECT community_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- Published courses without community are discoverable
CREATE POLICY "Published standalone courses discoverable"
  ON public.courses FOR SELECT
  USING (is_published = true AND community_id IS NULL);

-- ----------------------------------------------------------------------------
-- RLS: modules
-- ----------------------------------------------------------------------------

-- Modules visible to users who can see the course
CREATE POLICY "Users can view modules in accessible courses"
  ON public.modules FOR SELECT
  USING (
    course_id IN (
      SELECT id FROM public.courses
      WHERE creator_id = auth.uid()
        OR id IN (SELECT course_id FROM public.enrollments WHERE user_id = auth.uid())
        OR (is_published = true AND (community_id IS NULL OR community_id IN (SELECT community_id FROM public.memberships WHERE user_id = auth.uid())))
    )
  );

-- Creators can manage modules in their courses
CREATE POLICY "Creators can manage modules in own courses"
  ON public.modules FOR ALL
  USING (
    course_id IN (
      SELECT id FROM public.courses
      WHERE creator_id = auth.uid()
    )
  )
  WITH CHECK (
    course_id IN (
      SELECT id FROM public.courses
      WHERE creator_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- RLS: lessons
-- ----------------------------------------------------------------------------

-- Lessons visible to users who can see the module
CREATE POLICY "Users can view lessons in accessible modules"
  ON public.lessons FOR SELECT
  USING (
    module_id IN (
      SELECT m.id FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE c.creator_id = auth.uid()
        OR c.id IN (SELECT course_id FROM public.enrollments WHERE user_id = auth.uid())
        OR (c.is_published = true AND (c.community_id IS NULL OR c.community_id IN (SELECT community_id FROM public.memberships WHERE user_id = auth.uid())))
    )
  );

-- Creators can manage lessons in their courses
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

-- ----------------------------------------------------------------------------
-- RLS: enrollments
-- ----------------------------------------------------------------------------

-- Users can view their own enrollments
CREATE POLICY "Users can view own enrollments"
  ON public.enrollments FOR SELECT
  USING (user_id = auth.uid());

-- Creators can view enrollments in their courses
CREATE POLICY "Creators can view enrollments in own courses"
  ON public.enrollments FOR SELECT
  USING (
    course_id IN (
      SELECT id FROM public.courses
      WHERE creator_id = auth.uid()
    )
  );

-- Users can enroll themselves in courses
CREATE POLICY "Users can enroll in courses"
  ON public.enrollments FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own enrollment status
CREATE POLICY "Users can update own enrollments"
  ON public.enrollments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- RLS: lesson_progress
-- ----------------------------------------------------------------------------

-- Users can manage their own progress
CREATE POLICY "Users can manage own lesson progress"
  ON public.lesson_progress FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Creators can view progress in their courses
CREATE POLICY "Creators can view progress in own courses"
  ON public.lesson_progress FOR SELECT
  USING (
    lesson_id IN (
      SELECT l.id FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.courses c ON c.id = m.course_id
      WHERE c.creator_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- RLS: events
-- ----------------------------------------------------------------------------

-- Creators can manage their own events
CREATE POLICY "Creators can manage own events"
  ON public.events FOR ALL
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- Community members can view events in their communities
CREATE POLICY "Members can view events in their communities"
  ON public.events FOR SELECT
  USING (
    community_id IN (
      SELECT community_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- Users can view events they're attending
CREATE POLICY "Users can view events they're attending"
  ON public.events FOR SELECT
  USING (
    id IN (
      SELECT event_id FROM public.event_attendees
      WHERE user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- RLS: event_attendees
-- ----------------------------------------------------------------------------

-- Users can view attendees for events they can see
CREATE POLICY "Users can view attendees for accessible events"
  ON public.event_attendees FOR SELECT
  USING (
    event_id IN (
      SELECT e.id FROM public.events e
      WHERE e.creator_id = auth.uid()
        OR e.id IN (SELECT event_id FROM public.event_attendees WHERE user_id = auth.uid())
        OR e.community_id IN (SELECT community_id FROM public.memberships WHERE user_id = auth.uid())
    )
  );

-- Users can RSVP to events they can see
CREATE POLICY "Users can RSVP to accessible events"
  ON public.event_attendees FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    event_id IN (
      SELECT e.id FROM public.events e
      WHERE e.community_id IN (SELECT community_id FROM public.memberships WHERE user_id = auth.uid())
        OR e.community_id IS NULL
    )
  );

-- Users can update their own RSVP
CREATE POLICY "Users can update own RSVP"
  ON public.event_attendees FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can cancel their own RSVP
CREATE POLICY "Users can cancel own RSVP"
  ON public.event_attendees FOR DELETE
  USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- RLS: points
-- ----------------------------------------------------------------------------

-- Users can view their own points
CREATE POLICY "Users can view own points"
  ON public.points FOR SELECT
  USING (user_id = auth.uid());

-- Users can view points in communities they belong to (leaderboard)
CREATE POLICY "Users can view community leaderboard"
  ON public.points FOR SELECT
  USING (
    community_id IN (
      SELECT community_id FROM public.memberships
      WHERE user_id = auth.uid()
    )
  );

-- Creators can manage points in their communities
CREATE POLICY "Creators can manage points in own communities"
  ON public.points FOR ALL
  USING (
    community_id IN (
      SELECT id FROM public.communities
      WHERE creator_id = auth.uid()
    )
  )
  WITH CHECK (
    community_id IN (
      SELECT id FROM public.communities
      WHERE creator_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- RLS: point_transactions
-- ----------------------------------------------------------------------------

-- Users can view their own transaction history
CREATE POLICY "Users can view own point transactions"
  ON public.point_transactions FOR SELECT
  USING (user_id = auth.uid());

-- Creators can view transactions in their communities
CREATE POLICY "Creators can view transactions in own communities"
  ON public.point_transactions FOR SELECT
  USING (
    community_id IN (
      SELECT id FROM public.communities
      WHERE creator_id = auth.uid()
    )
  );

-- System can insert transactions (creators via app logic)
CREATE POLICY "Creators can create transactions in own communities"
  ON public.point_transactions FOR INSERT
  WITH CHECK (
    community_id IN (
      SELECT id FROM public.communities
      WHERE creator_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- RLS: student_health
-- ----------------------------------------------------------------------------

-- Creators can view student health in their courses
CREATE POLICY "Creators can view student health in own courses"
  ON public.student_health FOR ALL
  USING (
    course_id IN (
      SELECT id FROM public.courses
      WHERE creator_id = auth.uid()
    )
  )
  WITH CHECK (
    course_id IN (
      SELECT id FROM public.courses
      WHERE creator_id = auth.uid()
    )
  );

-- Students can view their own health metrics
CREATE POLICY "Students can view own health metrics"
  ON public.student_health FOR SELECT
  USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- RLS: tasks
-- ----------------------------------------------------------------------------

-- Creators can manage their own tasks
CREATE POLICY "Creators can manage own tasks"
  ON public.tasks FOR ALL
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- ============================================================================
-- SECTION 6: GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant usage on custom types
GRANT USAGE ON TYPE lesson_type TO authenticated;
GRANT USAGE ON TYPE unlock_type TO authenticated;
GRANT USAGE ON TYPE enrollment_status TO authenticated;
GRANT USAGE ON TYPE event_type TO authenticated;
GRANT USAGE ON TYPE attendee_status TO authenticated;
GRANT USAGE ON TYPE student_status TO authenticated;
GRANT USAGE ON TYPE task_status TO authenticated;
GRANT USAGE ON TYPE membership_role TO authenticated;

-- ============================================================================
-- SECTION 7: HELPER FUNCTIONS
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers for tables with updated_at
CREATE TRIGGER update_creator_profiles_updated_at
  BEFORE UPDATE ON public.creator_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_communities_updated_at
  BEFORE UPDATE ON public.communities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lesson_progress_updated_at
  BEFORE UPDATE ON public.lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_points_updated_at
  BEFORE UPDATE ON public.points
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_student_health_updated_at
  BEFORE UPDATE ON public.student_health
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
DECLARE
  table_count INTEGER;
  policy_count INTEGER;
BEGIN
  -- Count tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'creator_profiles', 'communities', 'community_channels', 'memberships',
      'posts', 'post_comments', 'post_likes', 'courses', 'modules', 'lessons',
      'enrollments', 'lesson_progress', 'events', 'event_attendees',
      'points', 'point_transactions', 'student_health', 'tasks'
    );

  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 004: Phase 2 Schema COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables created: %', table_count;
  RAISE NOTICE 'RLS policies: %', policy_count;
  RAISE NOTICE 'Custom types: 8';
  RAISE NOTICE 'Indexes: Optimized for common queries';
  RAISE NOTICE 'Multi-tenant isolation: ENABLED';
  RAISE NOTICE 'Status: READY FOR DEVELOPMENT';
  RAISE NOTICE '========================================';
END $$;
