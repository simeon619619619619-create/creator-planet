# Quiz-Based Module Unlock System Design

**Date:** 2026-01-04
**Status:** Approved
**Feature:** Quiz-based drip/unlock logic for course modules

## Overview

Allow creators to gate course modules behind quiz completion. Students must pass a quiz (70% threshold) before unlocking the next module. This enables knowledge verification and structured learning progression.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Quiz location | Quiz as lesson type | Reuses existing lesson infrastructure, flexible placement |
| Question types | Multiple choice only | Simple MVP, covers most use cases |
| Passing threshold | Fixed 70% | Simple, no creator decision paralysis |
| Retry behavior | Unlimited with shuffle | Learning-focused, not punitive |

## Data Model

### New Tables

```sql
-- Quiz questions belonging to a quiz lesson
CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Answer options for each question
CREATE TABLE quiz_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES quiz_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT false,
  position INTEGER DEFAULT 0
);

-- Student quiz attempts
CREATE TABLE quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  lesson_id UUID REFERENCES lessons(id),
  score_percent INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  answers JSONB, -- {question_id: selected_option_id}
  completed_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_quiz_questions_lesson ON quiz_questions(lesson_id);
CREATE INDEX idx_quiz_options_question ON quiz_options(question_id);
CREATE INDEX idx_quiz_attempts_user_lesson ON quiz_attempts(user_id, lesson_id);
```

### Schema Changes

```sql
-- Add 'quiz' to unlock_type enum
ALTER TYPE unlock_type ADD VALUE 'quiz';
```

### Existing Schema Integration

- `modules.unlock_type`: Add 'quiz' value (existing: immediate, date, progress)
- `modules.unlock_value`: Stores quiz lesson_id when unlock_type='quiz'
- `lessons.type`: Already has 'quiz' value (currently placeholder)
- `lesson_progress`: Tracks quiz completion like other lessons

## Creator Experience

### Quiz Builder UI

Located within lesson edit modal when lesson type is 'quiz':

**Features:**
- Add up to 20 questions per quiz
- Each question has 2-4 answer options
- Single correct answer per question (radio selection)
- Drag-to-reorder questions
- Character limits: 500 chars for questions, 200 chars for options

**Validation Rules:**
- Minimum 1 question required
- Each question needs exactly 1 correct answer
- Each question needs at least 2 options
- No empty question/option text

**UI Components:**
- `QuizBuilder` - Main quiz editing interface
- `QuizQuestionEditor` - Single question with options
- Inline add/delete buttons
- Visual indicator for correct answer

### Module Unlock Configuration

In ModuleEditModal, when "Quiz" unlock type selected:
- Dropdown shows quiz lessons from PREVIOUS module
- Stores selected quiz lesson_id in `unlock_value`
- Disabled for first module (no previous module)
- Shows message if no quiz lessons exist in previous module

## Student Experience

### Quiz Flow

1. Navigate to quiz lesson → see intro card (question count, 70% to pass)
2. Click "Start Quiz" → questions display one at a time
3. Select answer → can change before submitting
4. After all questions → click "Submit Quiz"
5. Results screen: score %, pass/fail, correct answers review
6. If failed → "Try Again" (questions reshuffled)
7. If passed → lesson marked complete, next module unlocked

### UI Components

- `QuizIntro` - Title, question count, passing threshold, start button
- `QuizQuestion` - Single question with radio options, progress indicator
- `QuizResults` - Score display, pass/fail badge, answer breakdown
- `QuizRetry` - Failure message with retry button

### State & Progress

- Quiz progress NOT saved mid-attempt (must complete in session)
- All attempts logged to `quiz_attempts` for creator analytics
- Passing attempt triggers `lesson_progress` completion
- Module unlock check runs after quiz completion

## Module Unlock Logic

```typescript
function isModuleUnlocked(module: Module, userId: string): boolean {
  switch (module.unlock_type) {
    case 'immediate':
      return true;
    case 'date':
      return new Date() >= new Date(module.unlock_value);
    case 'progress':
      return getPreviousModuleProgress(module, userId) >= parseInt(module.unlock_value);
    case 'quiz':
      return hasPassedQuiz(module.unlock_value, userId);
  }
}

function hasPassedQuiz(lessonId: string, userId: string): boolean {
  // Check quiz_attempts for any passing attempt
  return quiz_attempts.some(a =>
    a.lesson_id === lessonId &&
    a.user_id === userId &&
    a.passed === true
  );
}
```

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| First module with quiz unlock | Disabled - no previous module |
| No quiz lessons in previous module | Show message, can't select Quiz |
| Quiz lesson deleted | Module unlock falls back to immediate |
| Quiz with 0 questions | Validation prevents saving |
| Student closes mid-quiz | Progress lost, must restart |

## Implementation Plan

### Phase 1: Database
1. Create migration for quiz tables
2. Add 'quiz' to unlock_type enum
3. Add RLS policies for quiz tables

### Phase 2: Quiz Builder (Creator)
4. Create QuizBuilder component
5. Create QuizQuestionEditor component
6. Add quiz service functions (CRUD)
7. Integrate into LessonEditModal

### Phase 3: Quiz Taking (Student)
8. Create QuizIntro component
9. Create QuizQuestion component
10. Create QuizResults component
11. Add quiz attempt submission logic

### Phase 4: Module Unlock
12. Update ModuleEditModal with Quiz option
13. Add quiz lesson selector dropdown
14. Implement unlock check logic
15. Update module display to show locked state

### Phase 5: Polish
16. Add quiz analytics for creators
17. Handle edge cases (deleted quizzes, etc.)
18. Test complete flow

## Files to Create/Modify

**New Files:**
- `src/features/courses/components/QuizBuilder.tsx`
- `src/features/courses/components/QuizQuestionEditor.tsx`
- `src/features/courses/components/QuizIntro.tsx`
- `src/features/courses/components/QuizQuestion.tsx`
- `src/features/courses/components/QuizResults.tsx`
- `src/features/courses/quizService.ts`
- `supabase/migrations/015_quiz_system.sql`

**Modified Files:**
- `src/features/courses/components/ModuleEditModal.tsx` - Add Quiz unlock option
- `src/features/courses/components/LessonEditModal.tsx` - Integrate QuizBuilder
- `src/features/courses/CourseLMS.tsx` - Quiz taking UI, unlock logic
- `src/features/courses/courseService.ts` - Unlock check functions
- `src/core/supabase/database.types.ts` - Quiz types
