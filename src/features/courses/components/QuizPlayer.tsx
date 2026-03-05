// ============================================================================
// QUIZ PLAYER COMPONENT
// Allows students to take quizzes with intro, questions, and results screens
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  RefreshCw,
  Trophy,
  Target,
} from 'lucide-react';
import { getQuizQuestions, submitQuizAttempt, getBestQuizAttempt } from '../quizService';
import { DbQuizQuestionWithOptions, DbQuizResult, DbQuizAttempt } from '../../../core/supabase/database.types';

interface QuizPlayerProps {
  lessonId: string;
  lessonTitle: string;
  userId: string;
  onComplete?: (passed: boolean) => void;
}

type QuizState = 'loading' | 'intro' | 'playing' | 'submitting' | 'results';

const PASSING_THRESHOLD = 70;

// Shuffle array using Fisher-Yates
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const QuizPlayer: React.FC<QuizPlayerProps> = ({
  lessonId,
  lessonTitle,
  userId,
  onComplete,
}) => {
  const [state, setState] = useState<QuizState>('loading');
  const [questions, setQuestions] = useState<DbQuizQuestionWithOptions[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<DbQuizResult | null>(null);
  const [bestAttempt, setBestAttempt] = useState<DbQuizAttempt | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load quiz data
  useEffect(() => {
    async function loadQuiz() {
      setState('loading');
      setError(null);

      const [quizQuestions, previousBest] = await Promise.all([
        getQuizQuestions(lessonId),
        getBestQuizAttempt(lessonId, userId),
      ]);

      if (quizQuestions.length === 0) {
        setError('This quiz has no questions yet.');
        setState('intro');
        return;
      }

      setQuestions(quizQuestions);
      setBestAttempt(previousBest);
      setState('intro');
    }
    loadQuiz();
  }, [lessonId, userId]);

  // Shuffle questions when starting quiz
  const shuffledQuestions = useMemo(() => {
    if (state === 'playing') {
      return shuffleArray(questions);
    }
    return questions;
  }, [questions, state === 'playing']);

  const currentQuestion = shuffledQuestions[currentIndex];
  const totalQuestions = shuffledQuestions.length;
  const answeredCount = shuffledQuestions.filter((q) => {
    const value = answers[q.id] || '';
    return q.question_type === 'free_answer' ? value.trim().length > 0 : value.length > 0;
  }).length;
  const allAnswered = answeredCount === totalQuestions;

  function startQuiz() {
    setAnswers({});
    setCurrentIndex(0);
    setResult(null);
    setState('playing');
  }

  function selectAnswer(optionId: string) {
    if (!currentQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: optionId,
    }));
  }

  function updateFreeAnswer(value: string) {
    if (!currentQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: value,
    }));
  }

  function goToQuestion(index: number) {
    if (index >= 0 && index < totalQuestions) {
      setCurrentIndex(index);
    }
  }

  async function submitQuiz() {
    setState('submitting');
    setError(null);

    const quizResult = await submitQuizAttempt(lessonId, userId, answers);

    if (!quizResult) {
      setError('Failed to submit quiz. Please try again.');
      setState('playing');
      return;
    }

    setResult(quizResult);
    setState('results');
    onComplete?.(quizResult.passed);
  }

  // Loading state
  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#FAFAFA]" />
      </div>
    );
  }

  // Intro screen
  if (state === 'intro') {
    return (
      <div className="max-w-lg mx-auto text-center py-8">
        <div className="w-16 h-16 bg-[#1F1F1F] rounded-full flex items-center justify-center mx-auto mb-6">
          <HelpCircle className="w-8 h-8 text-[#FAFAFA]" />
        </div>

        <h2 className="text-2xl font-bold text-[#FAFAFA] mb-2">{lessonTitle}</h2>
        <p className="text-[#666666] mb-6">Quiz</p>

        {error ? (
          <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg p-4 mb-6">
            <p className="text-[#EF4444]">{error}</p>
          </div>
        ) : (
          <>
            <div className="bg-[#0A0A0A] rounded-xl p-6 mb-6">
              <div className="grid grid-cols-2 gap-4 text-left">
                <div>
                  <p className="text-sm text-[#666666]">Questions</p>
                  <p className="text-xl font-semibold text-[#FAFAFA]">{questions.length}</p>
                </div>
                <div>
                  <p className="text-sm text-[#666666]">Pass Score</p>
                  <p className="text-xl font-semibold text-[#FAFAFA]">{PASSING_THRESHOLD}%</p>
                </div>
              </div>

              {bestAttempt && (
                <div className="mt-4 pt-4 border-t border-[#1F1F1F]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#666666]">Your best score</span>
                    <span
                      className={`text-lg font-semibold ${
                        bestAttempt.passed ? 'text-[#22C55E]' : 'text-[#EAB308]'
                      }`}
                    >
                      {bestAttempt.score_percent}%
                      {bestAttempt.passed && (
                        <CheckCircle2 className="w-4 h-4 inline ml-1" />
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <ul className="text-left text-sm text-[#A0A0A0] mb-8 space-y-2">
              <li className="flex items-start gap-2">
                <Target size={16} className="text-[#FAFAFA] mt-0.5 shrink-0" />
                Answer at least {PASSING_THRESHOLD}% correctly to pass
              </li>
              <li className="flex items-start gap-2">
                <RefreshCw size={16} className="text-[#FAFAFA] mt-0.5 shrink-0" />
                Unlimited retries - questions shuffle each attempt
              </li>
            </ul>

            <button
              onClick={startQuiz}
              className="w-full py-3 bg-white text-black rounded-lg font-medium hover:bg-[#E0E0E0] transition-colors"
            >
              {bestAttempt ? 'Try Again' : 'Start Quiz'}
            </button>
          </>
        )}
      </div>
    );
  }

  // Playing state
  if (state === 'playing' || state === 'submitting') {
    return (
      <div className="max-w-2xl mx-auto">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-[#666666] mb-2">
            <span>
              Question {currentIndex + 1} of {totalQuestions}
            </span>
            <span>{answeredCount} answered</span>
          </div>
          <div className="h-2 bg-[#1F1F1F] rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] p-6 mb-6">
          <p className="text-lg font-medium text-[#FAFAFA] mb-6">
            {currentQuestion?.question_text}
          </p>

          {currentQuestion?.question_type === 'free_answer' ? (
            <textarea
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => updateFreeAnswer(e.target.value)}
              placeholder="Write your answer..."
              rows={4}
              disabled={state === 'submitting'}
              className="w-full px-4 py-3 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555] text-[#FAFAFA] resize-none"
            />
          ) : (
            <div className="space-y-3">
              {currentQuestion?.options.map((option) => {
                const isSelected = answers[currentQuestion.id] === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => selectAnswer(option.id)}
                    disabled={state === 'submitting'}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-white bg-[#1F1F1F]'
                        : 'border-[#1F1F1F] hover:border-[#333333] bg-[#0A0A0A]'
                    } ${state === 'submitting' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-white bg-white'
                            : 'border-[#333333]'
                        }`}
                      >
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-[#0A0A0A]" />
                        )}
                      </div>
                      <span className="text-[#A0A0A0]">{option.option_text}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => goToQuestion(currentIndex - 1)}
            disabled={currentIndex === 0 || state === 'submitting'}
            className="flex items-center gap-1 px-4 py-2 text-[#A0A0A0] hover:text-[#FAFAFA] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
            Previous
          </button>

          <div className="flex gap-1">
            {shuffledQuestions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => goToQuestion(i)}
                disabled={state === 'submitting'}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                  i === currentIndex
                    ? 'bg-white text-black'
                    : (q.question_type === 'free_answer'
                        ? (answers[q.id] || '').trim().length > 0
                        : !!answers[q.id])
                      ? 'bg-[#1F1F1F] text-[#FAFAFA]'
                      : 'bg-[#1F1F1F] text-[#666666] hover:bg-[#1F1F1F]'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {currentIndex < totalQuestions - 1 ? (
            <button
              onClick={() => goToQuestion(currentIndex + 1)}
              disabled={state === 'submitting'}
              className="flex items-center gap-1 px-4 py-2 text-[#FAFAFA] hover:text-[#FAFAFA] disabled:opacity-50"
            >
              Next
              <ChevronRight size={18} />
            </button>
          ) : (
            <button
              onClick={submitQuiz}
              disabled={!allAnswered || state === 'submitting'}
              className="flex items-center gap-2 px-6 py-2 bg-white text-black rounded-lg font-medium hover:bg-[#E0E0E0] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state === 'submitting' ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Quiz'
              )}
            </button>
          )}
        </div>

        {!allAnswered && currentIndex === totalQuestions - 1 && (
          <p className="text-center text-sm text-[#EAB308] mt-4">
            Answer all questions to submit
          </p>
        )}

        {error && (
          <div className="mt-4 p-3 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg text-[#EF4444] text-sm text-center">
            {error}
          </div>
        )}
      </div>
    );
  }

  // Results state
  if (state === 'results' && result) {
    return (
      <div className="max-w-2xl mx-auto">
        {/* Result header */}
        <div className="text-center mb-8">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
              result.passed ? 'bg-[#22C55E]/10' : 'bg-[#EAB308]/10'
            }`}
          >
            {result.passed ? (
              <Trophy className="w-10 h-10 text-[#22C55E]" />
            ) : (
              <Target className="w-10 h-10 text-[#EAB308]" />
            )}
          </div>

          <h2 className="text-2xl font-bold text-[#FAFAFA] mb-2">
            {result.passed ? 'Congratulations!' : 'Keep Learning!'}
          </h2>

          <p className="text-[#666666]">
            {result.passed
              ? 'You passed the quiz!'
              : `You need ${PASSING_THRESHOLD}% to pass. Try again!`}
          </p>
        </div>

        {/* Score card */}
        <div className="bg-[#0A0A0A] rounded-xl p-6 mb-6">
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <p
                className={`text-4xl font-bold ${
                  result.passed ? 'text-[#22C55E]' : 'text-[#EAB308]'
                }`}
              >
                {result.score_percent}%
              </p>
              <p className="text-sm text-[#666666]">Your Score</p>
            </div>
            <div className="h-12 w-px bg-[#1F1F1F]" />
            <div className="text-center">
              <p className="text-4xl font-bold text-[#FAFAFA]">
                {result.correct_answers}/{result.total_questions}
              </p>
              <p className="text-sm text-[#666666]">Correct</p>
            </div>
          </div>
        </div>

        {/* Answer review */}
        <div className="space-y-3 mb-8">
          <h3 className="font-medium text-[#FAFAFA]">Answer Review</h3>
          {result.question_results.map((qr, index) => (
            <div
              key={qr.question_id}
              className={`p-4 rounded-lg border ${
                qr.is_correct
                  ? 'bg-[#22C55E]/10 border-[#22C55E]/20'
                  : 'bg-[#EF4444]/10 border-[#EF4444]/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    qr.is_correct ? 'bg-[#22C55E]' : 'bg-[#EF4444]'
                  }`}
                >
                  {qr.is_correct ? (
                    <CheckCircle2 size={14} className="text-white" />
                  ) : (
                    <XCircle size={14} className="text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#FAFAFA] mb-1">
                    Q{index + 1}: {qr.question_text}
                  </p>
                  {qr.question_type === 'free_answer' ? (
                    <div className="text-xs text-[#A0A0A0] space-y-1">
                      <p>
                        Your answer:{' '}
                        <span className="font-medium text-[#FAFAFA]">
                          {qr.selected_answer_text || 'N/A'}
                        </span>
                      </p>
                      {!qr.is_correct && (
                        <p className="text-[#EF4444]">
                          Expected: {qr.correct_answer_text || 'N/A'}
                        </p>
                      )}
                    </div>
                  ) : (
                    !qr.is_correct && (
                      <p className="text-xs text-[#EF4444]">
                        Correct answer was different
                      </p>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {!result.passed && (
            <button
              onClick={startQuiz}
              className="flex-1 py-3 bg-white text-black rounded-lg font-medium hover:bg-[#E0E0E0] flex items-center justify-center gap-2"
            >
              <RefreshCw size={18} />
              Try Again
            </button>
          )}
          {result.passed && (
            <div className="flex-1 py-3 bg-[#22C55E]/10 text-[#22C55E] rounded-lg font-medium text-center flex items-center justify-center gap-2">
              <CheckCircle2 size={18} />
              Quiz Completed
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default QuizPlayer;
