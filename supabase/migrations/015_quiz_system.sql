-- ============================================================================
-- QUIZ SYSTEM MIGRATION
-- Adds quiz-based module unlock functionality
-- ============================================================================

-- Add 'quiz' to unlock_type enum
ALTER TYPE unlock_type ADD VALUE IF NOT EXISTS 'quiz';

-- ============================================================================
-- QUIZ QUESTIONS TABLE
-- Stores questions belonging to quiz-type lessons
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient lesson-based queries
CREATE INDEX IF NOT EXISTS idx_quiz_questions_lesson ON public.quiz_questions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_position ON public.quiz_questions(lesson_id, position);

-- ============================================================================
-- QUIZ OPTIONS TABLE
-- Stores answer options for each question
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.quiz_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT false,
  position INTEGER DEFAULT 0
);

-- Index for efficient question-based queries
CREATE INDEX IF NOT EXISTS idx_quiz_options_question ON public.quiz_options(question_id);

-- ============================================================================
-- QUIZ ATTEMPTS TABLE
-- Tracks student quiz submissions and scores
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  score_percent INTEGER NOT NULL CHECK (score_percent >= 0 AND score_percent <= 100),
  passed BOOLEAN NOT NULL,
  answers JSONB DEFAULT '{}', -- {question_id: selected_option_id}
  completed_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient user/lesson queries
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_lesson ON public.quiz_attempts(user_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_lesson ON public.quiz_attempts(lesson_id);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all quiz tables
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is course creator
CREATE OR REPLACE FUNCTION public.is_lesson_creator(p_lesson_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.lessons l
    JOIN public.modules m ON l.module_id = m.id
    JOIN public.courses c ON m.course_id = c.id
    WHERE l.id = p_lesson_id
    AND c.creator_id = public.get_my_profile_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check if user is enrolled in course containing lesson
CREATE OR REPLACE FUNCTION public.is_enrolled_in_lesson_course(p_lesson_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.lessons l
    JOIN public.modules m ON l.module_id = m.id
    JOIN public.enrollments e ON m.course_id = e.course_id
    WHERE l.id = p_lesson_id
    AND e.user_id = public.get_my_profile_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- QUIZ_QUESTIONS POLICIES
-- ============================================================================

-- Creators can manage questions in their courses
CREATE POLICY "Creators can insert quiz questions"
  ON public.quiz_questions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_lesson_creator(lesson_id));

CREATE POLICY "Creators can update quiz questions"
  ON public.quiz_questions FOR UPDATE
  TO authenticated
  USING (public.is_lesson_creator(lesson_id))
  WITH CHECK (public.is_lesson_creator(lesson_id));

CREATE POLICY "Creators can delete quiz questions"
  ON public.quiz_questions FOR DELETE
  TO authenticated
  USING (public.is_lesson_creator(lesson_id));

-- Anyone enrolled or the creator can view questions
CREATE POLICY "Users can view quiz questions"
  ON public.quiz_questions FOR SELECT
  TO authenticated
  USING (
    public.is_lesson_creator(lesson_id) OR
    public.is_enrolled_in_lesson_course(lesson_id)
  );

-- ============================================================================
-- QUIZ_OPTIONS POLICIES
-- ============================================================================

-- Helper to check creator via question
CREATE OR REPLACE FUNCTION public.is_question_creator(p_question_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.quiz_questions q
    WHERE q.id = p_question_id
    AND public.is_lesson_creator(q.lesson_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper to check enrollment via question
CREATE OR REPLACE FUNCTION public.is_enrolled_via_question(p_question_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.quiz_questions q
    WHERE q.id = p_question_id
    AND public.is_enrolled_in_lesson_course(q.lesson_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Creators can manage options
CREATE POLICY "Creators can insert quiz options"
  ON public.quiz_options FOR INSERT
  TO authenticated
  WITH CHECK (public.is_question_creator(question_id));

CREATE POLICY "Creators can update quiz options"
  ON public.quiz_options FOR UPDATE
  TO authenticated
  USING (public.is_question_creator(question_id))
  WITH CHECK (public.is_question_creator(question_id));

CREATE POLICY "Creators can delete quiz options"
  ON public.quiz_options FOR DELETE
  TO authenticated
  USING (public.is_question_creator(question_id));

-- Users can view options (enrolled students + creators)
CREATE POLICY "Users can view quiz options"
  ON public.quiz_options FOR SELECT
  TO authenticated
  USING (
    public.is_question_creator(question_id) OR
    public.is_enrolled_via_question(question_id)
  );

-- ============================================================================
-- QUIZ_ATTEMPTS POLICIES
-- ============================================================================

-- Users can insert their own attempts
CREATE POLICY "Users can insert own quiz attempts"
  ON public.quiz_attempts FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = public.get_my_profile_id() AND
    public.is_enrolled_in_lesson_course(lesson_id)
  );

-- Users can view their own attempts
CREATE POLICY "Users can view own quiz attempts"
  ON public.quiz_attempts FOR SELECT
  TO authenticated
  USING (user_id = public.get_my_profile_id());

-- Creators can view attempts for their courses
CREATE POLICY "Creators can view quiz attempts"
  ON public.quiz_attempts FOR SELECT
  TO authenticated
  USING (public.is_lesson_creator(lesson_id));

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_options TO authenticated;
GRANT SELECT, INSERT ON public.quiz_attempts TO authenticated;
