// ============================================================================
// QUIZ SERVICE
// CRUD operations for quiz questions, options, and attempts
// ============================================================================

import { supabase } from '../../core/supabase/client';
import {
  DbQuizQuestion,
  DbQuizOption,
  DbQuizQuestionWithOptions,
  DbQuizAttempt,
  DbQuizResult,
} from '../../core/supabase/database.types';

const PASSING_THRESHOLD = 70; // 70% to pass

// ============================================================================
// QUIZ QUESTIONS - CREATOR OPERATIONS
// ============================================================================

/**
 * Get all questions with options for a quiz lesson
 */
export async function getQuizQuestions(
  lessonId: string
): Promise<DbQuizQuestionWithOptions[]> {
  const { data: questions, error: qError } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('position');

  if (qError || !questions) {
    console.error('Error fetching quiz questions:', qError);
    return [];
  }

  // Fetch options for all questions
  const questionIds = questions.map((q) => q.id);
  if (questionIds.length === 0) return [];

  const { data: options, error: oError } = await supabase
    .from('quiz_options')
    .select('*')
    .in('question_id', questionIds)
    .order('position');

  if (oError) {
    console.error('Error fetching quiz options:', oError);
    return questions.map((q) => ({ ...q, options: [] }));
  }

  // Group options by question
  const optionsByQuestion = (options || []).reduce(
    (acc, opt) => {
      if (!acc[opt.question_id]) acc[opt.question_id] = [];
      acc[opt.question_id].push(opt);
      return acc;
    },
    {} as Record<string, DbQuizOption[]>
  );

  return questions.map((q) => ({
    ...q,
    options: optionsByQuestion[q.id] || [],
  }));
}

/**
 * Create a new quiz question
 */
export async function createQuizQuestion(
  lessonId: string,
  questionText: string,
  position: number,
  questionType: DbQuizQuestion['question_type'] = 'multiple_choice',
  correctAnswer: string | null = null
): Promise<DbQuizQuestion | null> {
  const { data, error } = await supabase
    .from('quiz_questions')
    .insert({
      lesson_id: lessonId,
      question_text: questionText,
      position,
      question_type: questionType,
      correct_answer: correctAnswer,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating quiz question:', error);
    return null;
  }
  return data;
}

/**
 * Update a quiz question
 */
export async function updateQuizQuestion(
  questionId: string,
  updates: Partial<
    Pick<DbQuizQuestion, 'question_text' | 'position' | 'question_type' | 'correct_answer'>
  >
): Promise<DbQuizQuestion | null> {
  const { data, error } = await supabase
    .from('quiz_questions')
    .update(updates)
    .eq('id', questionId)
    .select()
    .single();

  if (error) {
    console.error('Error updating quiz question:', error);
    return null;
  }
  return data;
}

/**
 * Delete a quiz question (cascades to options)
 */
export async function deleteQuizQuestion(questionId: string): Promise<boolean> {
  const { error } = await supabase
    .from('quiz_questions')
    .delete()
    .eq('id', questionId);

  if (error) {
    console.error('Error deleting quiz question:', error);
    return false;
  }
  return true;
}

// ============================================================================
// QUIZ OPTIONS - CREATOR OPERATIONS
// ============================================================================

/**
 * Create a quiz option
 */
export async function createQuizOption(
  questionId: string,
  optionText: string,
  isCorrect: boolean,
  position: number
): Promise<DbQuizOption | null> {
  const { data, error } = await supabase
    .from('quiz_options')
    .insert({
      question_id: questionId,
      option_text: optionText,
      is_correct: isCorrect,
      position,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating quiz option:', error);
    return null;
  }
  return data;
}

/**
 * Update a quiz option
 */
export async function updateQuizOption(
  optionId: string,
  updates: Partial<Pick<DbQuizOption, 'option_text' | 'is_correct' | 'position'>>
): Promise<DbQuizOption | null> {
  const { data, error } = await supabase
    .from('quiz_options')
    .update(updates)
    .eq('id', optionId)
    .select()
    .single();

  if (error) {
    console.error('Error updating quiz option:', error);
    return null;
  }
  return data;
}

/**
 * Delete a quiz option
 */
export async function deleteQuizOption(optionId: string): Promise<boolean> {
  const { error } = await supabase
    .from('quiz_options')
    .delete()
    .eq('id', optionId);

  if (error) {
    console.error('Error deleting quiz option:', error);
    return false;
  }
  return true;
}

/**
 * Batch save quiz questions and options (for quiz builder)
 * This replaces all questions/options for a lesson
 */
export async function saveQuizData(
  lessonId: string,
  questions: Array<{
    id?: string;
    question_text: string;
    question_type: DbQuizQuestion['question_type'];
    correct_answer: string | null;
    position: number;
    options: Array<{
      id?: string;
      option_text: string;
      is_correct: boolean;
      position: number;
    }>;
  }>
): Promise<boolean> {
  try {
    // Delete existing questions (cascades to options)
    const { error: deleteError } = await supabase
      .from('quiz_questions')
      .delete()
      .eq('lesson_id', lessonId);

    if (deleteError) {
      console.error('Error deleting existing questions:', deleteError);
      return false;
    }

    // Insert new questions and options
    for (const q of questions) {
      const { data: newQuestion, error: qError } = await supabase
        .from('quiz_questions')
        .insert({
          lesson_id: lessonId,
          question_text: q.question_text,
          question_type: q.question_type,
          correct_answer: q.correct_answer,
          position: q.position,
        })
        .select()
        .single();

      if (qError || !newQuestion) {
        console.error('Error creating question:', qError);
        return false;
      }

      // Insert options for this question
      if (q.question_type === 'multiple_choice' && q.options.length > 0) {
        const optionsToInsert = q.options.slice(0, 4).map((opt) => ({
          question_id: newQuestion.id,
          option_text: opt.option_text,
          is_correct: opt.is_correct,
          position: opt.position,
        }));

        const { error: oError } = await supabase
          .from('quiz_options')
          .insert(optionsToInsert);

        if (oError) {
          console.error('Error creating options:', oError);
          return false;
        }
      }
    }

    return true;
  } catch (err) {
    console.error('Error saving quiz data:', err);
    return false;
  }
}

// ============================================================================
// QUIZ ATTEMPTS - STUDENT OPERATIONS
// ============================================================================

/**
 * Submit a quiz attempt and calculate score
 */
export async function submitQuizAttempt(
  lessonId: string,
  userId: string,
  answers: Record<string, string> // {question_id: selected_option_id or free_answer}
): Promise<DbQuizResult | null> {
  try {
    // Fetch questions with correct answers
    const questions = await getQuizQuestions(lessonId);
    if (questions.length === 0) {
      console.error('No questions found for quiz');
      return null;
    }

    // Calculate score
    let correctCount = 0;
    const questionResults: DbQuizResult['question_results'] = [];

    for (const q of questions) {
      const selectedAnswer = answers[q.id] || '';
      const isFreeAnswer = q.question_type === 'free_answer';
      const correctOption = q.options.find((o) => o.is_correct);
      const selectedOptionId = isFreeAnswer ? null : selectedAnswer || null;
      const normalizedAnswer = selectedAnswer.trim().toLowerCase();
      const normalizedCorrect = (q.correct_answer || '').trim().toLowerCase();
      const isCorrect = isFreeAnswer
        ? normalizedAnswer.length > 0 && normalizedAnswer === normalizedCorrect
        : selectedOptionId === correctOption?.id;

      if (isCorrect) correctCount++;

      questionResults.push({
        question_id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        selected_option_id: selectedOptionId,
        correct_option_id: correctOption?.id || '',
        selected_answer_text: isFreeAnswer ? selectedAnswer || null : null,
        correct_answer_text: isFreeAnswer ? q.correct_answer || null : null,
        is_correct: isCorrect,
      });
    }

    const scorePercent = Math.round((correctCount / questions.length) * 100);
    const passed = scorePercent >= PASSING_THRESHOLD;

    // Save attempt
    const { error } = await supabase.from('quiz_attempts').insert({
      user_id: userId,
      lesson_id: lessonId,
      score_percent: scorePercent,
      passed,
      answers,
    });

    if (error) {
      console.error('Error saving quiz attempt:', error);
      return null;
    }

    return {
      score_percent: scorePercent,
      passed,
      total_questions: questions.length,
      correct_answers: correctCount,
      question_results: questionResults,
    };
  } catch (err) {
    console.error('Error submitting quiz attempt:', err);
    return null;
  }
}

/**
 * Check if user has passed a quiz
 */
export async function hasPassedQuiz(
  lessonId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('passed')
    .eq('lesson_id', lessonId)
    .eq('user_id', userId)
    .eq('passed', true)
    .limit(1);

  if (error) {
    console.error('Error checking quiz pass status:', error);
    return false;
  }

  return (data?.length || 0) > 0;
}

/**
 * Get user's quiz attempts for a lesson
 */
export async function getQuizAttempts(
  lessonId: string,
  userId: string
): Promise<DbQuizAttempt[]> {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('lesson_id', lessonId)
    .eq('user_id', userId)
    .order('completed_at', { ascending: false });

  if (error) {
    console.error('Error fetching quiz attempts:', error);
    return [];
  }

  return data || [];
}

/**
 * Get best quiz attempt for a lesson
 */
export async function getBestQuizAttempt(
  lessonId: string,
  userId: string
): Promise<DbQuizAttempt | null> {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('lesson_id', lessonId)
    .eq('user_id', userId)
    .order('score_percent', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching best quiz attempt:', error);
    return null;
  }

  return data;
}

// ============================================================================
// QUIZ ANALYTICS - CREATOR OPERATIONS
// ============================================================================

/**
 * Get quiz statistics for a lesson (for creators)
 */
export async function getQuizStats(lessonId: string): Promise<{
  totalAttempts: number;
  uniqueStudents: number;
  passRate: number;
  averageScore: number;
}> {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('user_id, score_percent, passed')
    .eq('lesson_id', lessonId);

  if (error || !data) {
    console.error('Error fetching quiz stats:', error);
    return { totalAttempts: 0, uniqueStudents: 0, passRate: 0, averageScore: 0 };
  }

  const totalAttempts = data.length;
  const uniqueStudents = new Set(data.map((a) => a.user_id)).size;
  const passedAttempts = data.filter((a) => a.passed).length;
  const passRate = totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : 0;
  const averageScore =
    totalAttempts > 0
      ? Math.round(data.reduce((sum, a) => sum + a.score_percent, 0) / totalAttempts)
      : 0;

  return { totalAttempts, uniqueStudents, passRate, averageScore };
}

// ============================================================================
// MODULE UNLOCK CHECK
// ============================================================================

/**
 * Check if a module is unlocked for a user (handles quiz unlock type)
 */
export async function isModuleUnlockedByQuiz(
  unlockValue: string | null,
  userId: string
): Promise<boolean> {
  if (!unlockValue) return true; // No quiz specified = unlocked

  return hasPassedQuiz(unlockValue, userId);
}

/**
 * Get quiz lessons in a module (for module unlock selector)
 */
export async function getQuizLessonsInModule(
  moduleId: string
): Promise<Array<{ id: string; title: string }>> {
  const { data, error } = await supabase
    .from('lessons')
    .select('id, title')
    .eq('module_id', moduleId)
    .eq('type', 'quiz')
    .order('position');

  if (error) {
    console.error('Error fetching quiz lessons:', error);
    return [];
  }

  return data || [];
}
