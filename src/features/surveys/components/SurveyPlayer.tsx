// =============================================================================
// SURVEY PLAYER
// Student-facing component for completing surveys
// =============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import confetti from 'canvas-confetti';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Sparkles,
} from 'lucide-react';
import type {
  SurveyWithDetails,
  SurveyQuestion,
  SurveySection,
  SurveyResponse,
  AnswerFormData,
} from '../surveyTypes';
import {
  getSurvey,
  getOrCreateResponse,
  saveAnswer,
  submitResponse,
  getStudentResponse,
} from '../surveyService';

// =============================================================================
// Question Renderer Component
// =============================================================================

interface QuestionRendererProps {
  question: SurveyQuestion;
  answer: string | string[] | null;
  otherValue: string | null;
  onChange: (value: string | string[], otherValue?: string) => void;
  disabled?: boolean;
}

const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  question,
  answer,
  otherValue,
  onChange,
  disabled,
}) => {
  const { t } = useTranslation();

  switch (question.question_type) {
    case 'text':
      return (
        <input
          type="text"
          value={(answer as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder || t('surveys.player.typeAnswer')}
          disabled={disabled}
          className="w-full px-4 py-3 border border-[var(--fc-section-border,#1F1F1F)] rounded-xl focus:ring-1 focus:ring-white/10 focus:border-[var(--fc-section-text,#555555)] disabled:bg-[var(--fc-section-hover,#1F1F1F)] disabled:cursor-not-allowed"
        />
      );

    case 'number':
      return (
        <input
          type="number"
          value={(answer as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder || t('surveys.player.enterNumber')}
          min={question.min_value ?? undefined}
          max={question.max_value ?? undefined}
          disabled={disabled}
          className="w-full px-4 py-3 border border-[var(--fc-section-border,#1F1F1F)] rounded-xl focus:ring-1 focus:ring-white/10 focus:border-[var(--fc-section-text,#555555)] disabled:bg-[var(--fc-section-hover,#1F1F1F)] disabled:cursor-not-allowed"
        />
      );

    case 'scale':
      const scale = Array.from({ length: 10 }, (_, i) => i + 1);
      return (
        <div className="grid grid-cols-5 gap-2 sm:flex sm:flex-wrap">
          {scale.map((num) => (
            <button
              key={num}
              onClick={() => !disabled && onChange(String(num))}
              disabled={disabled}
              className={`w-12 h-12 rounded-xl font-semibold transition-all ${
                answer === String(num)
                  ? 'bg-[var(--fc-text,white)] text-[var(--fc-surface,black)]'
                  : 'bg-[var(--fc-section-hover,#1F1F1F)] text-[var(--fc-section-muted,#A0A0A0)] hover:bg-[var(--fc-section-hover,#1F1F1F)] hover:text-[var(--fc-section-muted,#A0A0A0)]'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              {num}
            </button>
          ))}
        </div>
      );

    case 'single_choice':
      return (
        <div className="space-y-2">
          {question.options?.map((option, index) => (
            <label
              key={index}
              className={`flex items-center gap-3 p-3 sm:p-4 border rounded-xl cursor-pointer transition-all ${
                answer === option
                  ? 'border-[#333333] bg-[var(--fc-section-hover,#151515)]'
                  : 'border-[var(--fc-section-border,#1F1F1F)] hover:border-[#333333] hover:bg-[var(--fc-section,#0A0A0A)]'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="radio"
                name={question.id}
                value={option}
                checked={answer === option}
                onChange={() => !disabled && onChange(option)}
                disabled={disabled}
                className="w-5 h-5 text-[var(--fc-section-text,#FAFAFA)] border-[var(--fc-section-border,#1F1F1F)] focus:ring-white/10"
              />
              <span className="text-[var(--fc-section-text,#FAFAFA)]">{option}</span>
            </label>
          ))}
          {question.allow_other && (
            <label
              className={`flex items-start gap-3 p-3 sm:p-4 border rounded-xl cursor-pointer transition-all ${
                answer === '__other__'
                  ? 'border-[#333333] bg-[var(--fc-section-hover,#151515)]'
                  : 'border-[var(--fc-section-border,#1F1F1F)] hover:border-[#333333] hover:bg-[var(--fc-section,#0A0A0A)]'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="radio"
                name={question.id}
                value="__other__"
                checked={answer === '__other__'}
                onChange={() => !disabled && onChange('__other__')}
                disabled={disabled}
                className="w-5 h-5 text-[var(--fc-section-text,#FAFAFA)] border-[var(--fc-section-border,#1F1F1F)] focus:ring-white/10 mt-0.5"
              />
              <div className="flex-1">
                <span className="text-[var(--fc-section-text,#FAFAFA)]">{t('surveys.player.other')}</span>
                {answer === '__other__' && (
                  <input
                    type="text"
                    value={otherValue || ''}
                    onChange={(e) => onChange('__other__', e.target.value)}
                    placeholder={t('surveys.player.specifyOther')}
                    disabled={disabled}
                    className="mt-2 w-full px-3 py-2 text-sm border border-[var(--fc-section-border,#1F1F1F)] rounded-lg focus:ring-1 focus:ring-white/10"
                  />
                )}
              </div>
            </label>
          )}
        </div>
      );

    case 'multi_choice':
      const selectedValues = (Array.isArray(answer) ? answer : []) as string[];
      const toggleOption = (option: string) => {
        if (disabled) return;
        if (selectedValues.includes(option)) {
          onChange(selectedValues.filter((v) => v !== option));
        } else {
          onChange([...selectedValues, option]);
        }
      };

      return (
        <div className="space-y-2">
          {question.options?.map((option, index) => (
            <label
              key={index}
              className={`flex items-center gap-3 p-3 sm:p-4 border rounded-xl cursor-pointer transition-all ${
                selectedValues.includes(option)
                  ? 'border-[#333333] bg-[var(--fc-section-hover,#151515)]'
                  : 'border-[var(--fc-section-border,#1F1F1F)] hover:border-[#333333] hover:bg-[var(--fc-section,#0A0A0A)]'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="checkbox"
                value={option}
                checked={selectedValues.includes(option)}
                onChange={() => toggleOption(option)}
                disabled={disabled}
                className="w-5 h-5 text-[var(--fc-section-text,#FAFAFA)] border-[var(--fc-section-border,#1F1F1F)] rounded focus:ring-white/10"
              />
              <span className="text-[var(--fc-section-text,#FAFAFA)]">{option}</span>
            </label>
          ))}
          {question.allow_other && (
            <label
              className={`flex items-start gap-3 p-3 sm:p-4 border rounded-xl cursor-pointer transition-all ${
                selectedValues.includes('__other__')
                  ? 'border-[#333333] bg-[var(--fc-section-hover,#151515)]'
                  : 'border-[var(--fc-section-border,#1F1F1F)] hover:border-[#333333] hover:bg-[var(--fc-section,#0A0A0A)]'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="checkbox"
                value="__other__"
                checked={selectedValues.includes('__other__')}
                onChange={() => toggleOption('__other__')}
                disabled={disabled}
                className="w-5 h-5 text-[var(--fc-section-text,#FAFAFA)] border-[var(--fc-section-border,#1F1F1F)] rounded focus:ring-white/10 mt-0.5"
              />
              <div className="flex-1">
                <span className="text-[var(--fc-section-text,#FAFAFA)]">{t('surveys.player.other')}</span>
                {selectedValues.includes('__other__') && (
                  <input
                    type="text"
                    value={otherValue || ''}
                    onChange={(e) => onChange(selectedValues, e.target.value)}
                    placeholder={t('surveys.player.specifyOther')}
                    disabled={disabled}
                    className="mt-2 w-full px-3 py-2 text-sm border border-[var(--fc-section-border,#1F1F1F)] rounded-lg focus:ring-1 focus:ring-white/10"
                  />
                )}
              </div>
            </label>
          )}
        </div>
      );

    default:
      return null;
  }
};

// =============================================================================
// Main Survey Player Component
// =============================================================================

interface SurveyPlayerProps {
  surveyId: string;
  studentId: string;
  onComplete?: () => void;
  onClose?: () => void;
}

const SurveyPlayer: React.FC<SurveyPlayerProps> = ({
  surveyId,
  studentId,
  onComplete,
  onClose,
}) => {
  const { t } = useTranslation();
  const [survey, setSurvey] = useState<SurveyWithDetails | null>(null);
  const [response, setResponse] = useState<SurveyResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, { value: string | string[]; other: string | null }>>({});
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  // Ref for scrolling to top of content (works in both modal and full-page contexts)
  const contentTopRef = useRef<HTMLDivElement>(null);

  // Trigger celebration confetti
  const triggerCelebration = useCallback(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!prefersReducedMotion) {
      // Fire confetti from both sides
      const duration = 2000;
      const end = Date.now() + duration;

      const colors = ['#FFFFFF', '#A0A0A0', '#22C55E', '#FAFAFA', '#666666', '#333333'];

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors,
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };

      // Initial burst from center
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors,
      });

      frame();
    }

    setShowCelebration(true);
  }, []);

  // Load survey and existing response
  useEffect(() => {
    const loadData = async () => {
      try {
        const [surveyData, existingResponse] = await Promise.all([
          getSurvey(surveyId),
          getStudentResponse(surveyId, studentId),
        ]);

        if (!surveyData) {
          setError(t('surveys.player.notFound'));
          return;
        }

        setSurvey(surveyData);

        if (existingResponse) {
          setResponse(existingResponse);
          if (existingResponse.is_complete) {
            setIsSubmitted(true);
          }
          // Load existing answers
          const existingAnswers: Record<string, { value: string | string[]; other: string | null }> = {};
          existingResponse.answers.forEach((ans) => {
            existingAnswers[ans.question_id] = {
              value: ans.answer_value as string | string[],
              other: ans.other_value,
            };
          });
          setAnswers(existingAnswers);
        } else {
          // Create new response
          const newResponse = await getOrCreateResponse(surveyId, studentId);
          setResponse(newResponse);
        }
      } catch (err) {
        console.error('Failed to load survey:', err);
        setError(t('surveys.player.loadError'));
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [surveyId, studentId, t]);

  // Get questions grouped by section
  const getQuestionsBySection = useCallback(() => {
    if (!survey) return [];

    // If no sections, return all questions as one "section"
    if (survey.sections.length === 0) {
      return [{ section: null, questions: survey.questions }];
    }

    // Group questions by section
    const grouped = survey.sections.map((section) => ({
      section,
      questions: survey.questions.filter((q) => q.section_id === section.id),
    }));

    // Add unsectioned questions at the beginning
    const unsectioned = survey.questions.filter((q) => !q.section_id);
    if (unsectioned.length > 0) {
      grouped.unshift({ section: null, questions: unsectioned });
    }

    return grouped;
  }, [survey]);

  const sections = getQuestionsBySection();
  const currentSection = sections[currentSectionIndex];

  // Handle answer change
  const handleAnswerChange = useCallback(
    async (questionId: string, value: string | string[], otherValue?: string) => {
      if (!response) return;

      setAnswers((prev) => ({
        ...prev,
        [questionId]: { value, other: otherValue ?? prev[questionId]?.other ?? null },
      }));

      // Auto-save answer
      setIsSaving(true);
      try {
        await saveAnswer(response.id, {
          question_id: questionId,
          answer_value: value,
          other_value: otherValue ?? answers[questionId]?.other ?? null,
        });
      } catch (err) {
        console.error('Failed to save answer:', err);
      } finally {
        setIsSaving(false);
      }
    },
    [response, answers]
  );

  // Check if current section is complete
  const isSectionComplete = useCallback(() => {
    if (!currentSection) return true;

    return currentSection.questions.every((q) => {
      if (!q.is_required) return true;
      const answer = answers[q.id];
      if (!answer) return false;
      if (Array.isArray(answer.value)) return answer.value.length > 0;
      return !!answer.value;
    });
  }, [currentSection, answers]);

  // Scroll to top of content (works in both modal and full-page contexts)
  const scrollToTop = useCallback(() => {
    if (contentTopRef.current) {
      contentTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  // Navigate to next section
  const handleNext = () => {
    if (currentSectionIndex < sections.length - 1) {
      setCurrentSectionIndex((prev) => prev + 1);
      // Use setTimeout to ensure state update has rendered before scrolling
      setTimeout(scrollToTop, 50);
    }
  };

  // Navigate to previous section
  const handlePrevious = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex((prev) => prev - 1);
      // Use setTimeout to ensure state update has rendered before scrolling
      setTimeout(scrollToTop, 50);
    }
  };

  // Submit survey
  const handleSubmit = async () => {
    if (!response) return;

    // Validate all required questions
    const unanswered = survey?.questions.filter((q) => {
      if (!q.is_required) return false;
      const answer = answers[q.id];
      if (!answer) return true;
      if (Array.isArray(answer.value)) return answer.value.length === 0;
      return !answer.value;
    });

    if (unanswered && unanswered.length > 0) {
      alert(t('surveys.player.requiredFieldsError', { count: unanswered.length }));
      return;
    }

    setIsSaving(true);
    try {
      await submitResponse(response.id);
      setIsSubmitted(true);
      triggerCelebration();
      onComplete?.();
    } catch (err) {
      console.error('Failed to submit survey:', err);
      alert(t('surveys.player.submitError'));
    } finally {
      setIsSaving(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--fc-section,#0A0A0A)]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-[var(--fc-section-text,#FAFAFA)] animate-spin mx-auto" />
          <p className="mt-4 text-[var(--fc-section-muted,#A0A0A0)]">{t('surveys.player.loading')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !survey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--fc-section,#0A0A0A)]">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-[#EF4444] mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-[var(--fc-section-text,#FAFAFA)]">
            {t('surveys.player.errorTitle')}
          </h2>
          <p className="mt-2 text-[var(--fc-section-muted,#A0A0A0)]">{error}</p>
          {onClose && (
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] rounded-lg hover:bg-[var(--fc-button-hover,#E0E0E0)]"
            >
              {t('common.goBack')}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Submitted state with celebration
  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--fc-section,#0A0A0A)] overflow-hidden">
        <div className="text-center max-w-md px-4">
          {/* Animated success icon */}
          <div
            className={`relative mx-auto transition-all duration-700 ease-out ${
              showCelebration ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
            }`}
          >
            {/* Outer glow ring */}
            <div className="absolute inset-0 w-24 h-24 mx-auto rounded-full bg-[#22C55E]/30 animate-ping" />

            {/* Inner pulsing ring */}
            <div className="absolute inset-0 w-24 h-24 mx-auto rounded-full bg-[#22C55E]/20 animate-pulse" />

            {/* Main icon container */}
            <div
              className={`relative w-24 h-24 mx-auto bg-[#22C55E] rounded-full flex items-center justify-center transition-transform duration-500 ${
                showCelebration ? 'animate-bounce' : ''
              }`}
              style={{ animationDuration: '1s', animationIterationCount: '2' }}
            >
              <CheckCircle className="w-12 h-12 text-white" />
            </div>

            {/* Sparkle accents */}
            <Sparkles
              className={`absolute -top-2 -right-2 w-6 h-6 text-[#EAB308] transition-all duration-500 delay-300 ${
                showCelebration ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
              }`}
            />
            <Sparkles
              className={`absolute -bottom-1 -left-3 w-5 h-5 text-[#EAB308] transition-all duration-500 delay-500 ${
                showCelebration ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
              }`}
            />
          </div>

          {/* Thank you text with staggered animation */}
          <h2
            className={`mt-8 text-3xl font-bold text-[#22C55E] transition-all duration-500 delay-200 ${
              showCelebration ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            {t('surveys.player.thankYou')}
          </h2>

          {/* Subtitle message */}
          <p
            className={`mt-3 text-lg text-[var(--fc-section-muted,#A0A0A0)] transition-all duration-500 delay-400 ${
              showCelebration ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            {t('surveys.player.submittedMessage')}
          </p>

          {/* Encouraging message */}
          <p
            className={`mt-2 text-sm text-[#22C55E] font-medium transition-all duration-500 delay-500 ${
              showCelebration ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            {t('surveys.player.completionEncouragement')}
          </p>

          {/* Continue button */}
          {onClose && (
            <button
              onClick={onClose}
              className={`mt-10 group relative px-10 py-4 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] font-semibold rounded-2xl hover:bg-[var(--fc-button-hover,#E0E0E0)] hover:scale-105 active:scale-100 transition-all duration-300 delay-700 ${
                showCelebration ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              <span className="relative flex items-center gap-2">
                {t('surveys.player.continue')}
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const progress = ((currentSectionIndex + 1) / sections.length) * 100;
  const isLastSection = currentSectionIndex === sections.length - 1;

  return (
    <div className="min-h-screen bg-[var(--fc-section,#0A0A0A)]">
      {/* Scroll anchor - must be before sticky header for scrollIntoView to work */}
      <div ref={contentTopRef} className="h-0" aria-hidden="true" />

      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1.5 sm:h-1 bg-[var(--fc-section-hover,#1F1F1F)] z-20">
        <div
          className="h-full bg-white transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <div className="bg-[var(--fc-section,#0A0A0A)] border-b border-[var(--fc-section-border,#1F1F1F)] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-[var(--fc-section-text,#FAFAFA)] truncate">{survey.title}</h1>
              <p className="text-sm text-[var(--fc-section-muted,#666666)]">
                {t('surveys.player.sectionProgress', {
                  current: currentSectionIndex + 1,
                  total: sections.length,
                })}
              </p>
            </div>
            <div className="flex items-center gap-3 ml-4">
              {isSaving && (
                <div className="flex items-center gap-2 text-sm text-[var(--fc-section-muted,#666666)]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('surveys.player.saving')}
                </div>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-section-muted,#A0A0A0)] hover:bg-[var(--fc-section-hover,#1F1F1F)] rounded-lg transition-colors"
                  title={t('surveys.player.close')}
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Section Header */}
        {currentSection?.section && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-[var(--fc-section-text,#FAFAFA)]">{currentSection.section.title}</h2>
            {currentSection.section.description && (
              <p className="mt-2 text-[var(--fc-section-muted,#A0A0A0)]">{currentSection.section.description}</p>
            )}
          </div>
        )}

        {/* Questions */}
        <div className="space-y-8">
          {currentSection?.questions.map((question, index) => (
            <div key={question.id} className="bg-[var(--fc-section,#0A0A0A)] rounded-xl border border-[var(--fc-section-border,#1F1F1F)] p-4 sm:p-6">
              <div className="flex gap-3 mb-4">
                <span className="w-8 h-8 bg-[var(--fc-section-hover,#1F1F1F)] text-[var(--fc-section-text,#FAFAFA)] rounded-lg flex items-center justify-center font-semibold text-sm shrink-0">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-medium text-[var(--fc-section-text,#FAFAFA)]">
                    {question.question_text}
                    {question.is_required && <span className="text-[#EF4444] ml-1">*</span>}
                  </h3>
                </div>
              </div>
              <div className="pl-0 sm:pl-11">
                <QuestionRenderer
                  question={question}
                  answer={answers[question.id]?.value ?? null}
                  otherValue={answers[question.id]?.other ?? null}
                  onChange={(value, other) => handleAnswerChange(question.id, value, other)}
                  disabled={isSubmitted}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="sticky bottom-0 bg-[var(--fc-section,#0A0A0A)] sm:static sm:bg-transparent pt-4 sm:pt-6 mt-6 sm:mt-8 pb-[env(safe-area-inset-bottom)] sm:pb-0 border-t border-[var(--fc-section-border,#1F1F1F)] flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentSectionIndex === 0}
            className="flex items-center gap-2 px-4 py-2 text-[var(--fc-section-muted,#A0A0A0)] hover:bg-[var(--fc-section-hover,#1F1F1F)] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
            {t('surveys.player.previous')}
          </button>

          {isLastSection ? (
            <div className="w-full sm:w-auto ml-4">
              <button
                onClick={handleSubmit}
                disabled={!isSectionComplete() || isSaving}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-[#22C55E] text-white font-medium rounded-xl hover:bg-[#22C55E]/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Check className="w-5 h-5" />
                )}
                {t('surveys.player.submit')}
              </button>
            </div>
          ) : (
            <div className="w-full sm:w-auto ml-4">
              <button
                onClick={handleNext}
                disabled={!isSectionComplete()}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] font-medium rounded-xl hover:bg-[var(--fc-button-hover,#E0E0E0)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('surveys.player.next')}
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SurveyPlayer;
