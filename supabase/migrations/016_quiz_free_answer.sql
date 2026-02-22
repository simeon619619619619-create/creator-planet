-- ============================================================================
-- QUIZ FREE ANSWER SUPPORT
-- Adds question_type and correct_answer fields for free answer questions
-- ============================================================================

ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  ADD COLUMN IF NOT EXISTS correct_answer TEXT;

UPDATE public.quiz_questions
SET question_type = 'multiple_choice'
WHERE question_type IS NULL;

