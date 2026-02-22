// ============================================================================
// ONBOARDING QUESTION COMPONENT
// Split-screen full-screen question display with animations
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dumbbell,
  Briefcase,
  Palette,
  Code,
  Brain,
  Heart,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';

// Icon mapping for question options
const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  dumbbell: Dumbbell,
  briefcase: Briefcase,
  palette: Palette,
  code: Code,
  brain: Brain,
  heart: Heart,
};

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
}

export interface OnboardingQuestionProps {
  question: {
    id: string;
    title: string;
    subtitle?: string;
    type: 'single' | 'multi' | 'text';
    options: QuestionOption[];
    allowOther?: boolean;
    otherFieldId?: string;
  };
  currentAnswer: string | string[] | null;
  otherValue?: string | null;
  onAnswer: (value: string | string[]) => void;
  onOtherChange?: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  canGoBack: boolean;
  questionNumber: number;
  totalQuestions: number;
}

// CSS keyframes for animations
const animationStyles = `
  @keyframes float-orb-1 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    25% { transform: translate(30px, -20px) scale(1.05); }
    50% { transform: translate(-10px, 30px) scale(0.95); }
    75% { transform: translate(-30px, -10px) scale(1.02); }
  }

  @keyframes float-orb-2 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    25% { transform: translate(-40px, 20px) scale(0.98); }
    50% { transform: translate(20px, -30px) scale(1.03); }
    75% { transform: translate(25px, 15px) scale(0.97); }
  }

  @keyframes float-orb-3 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(35px, 25px) scale(1.04); }
    66% { transform: translate(-25px, -20px) scale(0.96); }
  }

  @keyframes pulse-select {
    0% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }

  @keyframes slide-in-right {
    0% { opacity: 0; transform: translateX(30px); }
    100% { opacity: 1; transform: translateX(0); }
  }

  @keyframes slide-out-left {
    0% { opacity: 1; transform: translateX(0); }
    100% { opacity: 0; transform: translateX(-30px); }
  }

  @keyframes fade-in-up {
    0% { opacity: 0; transform: translateY(10px); }
    100% { opacity: 1; transform: translateY(0); }
  }
`;

const OnboardingQuestion: React.FC<OnboardingQuestionProps> = ({
  question,
  currentAnswer,
  otherValue,
  onAnswer,
  onOtherChange,
  onNext,
  onBack,
  canGoBack,
  questionNumber,
  totalQuestions,
}) => {
  const { t } = useTranslation();
  const [transitionState, setTransitionState] = useState<'entering' | 'visible' | 'exiting'>('entering');
  const [otherInputValue, setOtherInputValue] = useState(otherValue || '');
  const [textInputValue, setTextInputValue] = useState(
    question.type === 'text' && typeof currentAnswer === 'string' ? currentAnswer : ''
  );
  const [selectedAnimation, setSelectedAnimation] = useState<string | null>(null);
  const [cardsVisible, setCardsVisible] = useState(false);
  const previousQuestionId = useRef(question.id);

  // Handle question transitions
  useEffect(() => {
    if (previousQuestionId.current !== question.id) {
      // Question changed - animate transition
      setTransitionState('entering');
      setCardsVisible(false);

      const enterTimer = setTimeout(() => {
        setTransitionState('visible');
        // Stagger card entrance
        setTimeout(() => setCardsVisible(true), 50);
      }, 50);

      previousQuestionId.current = question.id;
      return () => clearTimeout(enterTimer);
    } else {
      // Initial mount
      setTransitionState('visible');
      setTimeout(() => setCardsVisible(true), 100);
    }
  }, [question.id]);

  // Sync other input value with prop
  useEffect(() => {
    setOtherInputValue(otherValue || '');
  }, [otherValue]);

  // Sync text input value with current answer
  useEffect(() => {
    if (question.type === 'text' && typeof currentAnswer === 'string') {
      setTextInputValue(currentAnswer);
    }
  }, [currentAnswer, question.type]);

  // Check if an option is selected
  const isSelected = useCallback(
    (value: string): boolean => {
      if (question.type === 'single') {
        return currentAnswer === value;
      }
      if (question.type === 'multi' && Array.isArray(currentAnswer)) {
        return currentAnswer.includes(value);
      }
      return false;
    },
    [currentAnswer, question.type]
  );

  // Handle option click
  const handleOptionClick = useCallback(
    (value: string) => {
      // Trigger pulse animation
      setSelectedAnimation(value);
      setTimeout(() => setSelectedAnimation(null), 150);

      if (question.type === 'single') {
        onAnswer(value);
        // Auto-advance for single-select (unless it's "other")
        if (value !== 'other' && !question.allowOther) {
          setTimeout(() => onNext(), 300);
        } else if (value !== 'other') {
          setTimeout(() => onNext(), 300);
        }
      } else if (question.type === 'multi') {
        const currentArray = Array.isArray(currentAnswer) ? currentAnswer : [];
        if (currentArray.includes(value)) {
          // Deselect
          onAnswer(currentArray.filter((v) => v !== value));
        } else {
          // Select
          onAnswer([...currentArray, value]);
        }
      }
    },
    [question.type, question.allowOther, currentAnswer, onAnswer, onNext]
  );

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Number keys 1-9 to select options
      const keyNum = parseInt(e.key, 10);
      if (keyNum >= 1 && keyNum <= question.options.length) {
        const option = question.options[keyNum - 1];
        handleOptionClick(option.value);
      }

      // 0 key for "other" option
      if (e.key === '0' && question.allowOther) {
        handleOptionClick('other');
      }

      // Enter to continue
      if (e.key === 'Enter' && !e.shiftKey) {
        if (question.type === 'text' && textInputValue.trim()) {
          onAnswer(textInputValue.trim());
          onNext();
        } else if (currentAnswer) {
          onNext();
        }
      }

      // Escape or left arrow to go back
      if ((e.key === 'Escape' || e.key === 'ArrowLeft') && canGoBack) {
        onBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    question.options,
    question.allowOther,
    question.type,
    handleOptionClick,
    currentAnswer,
    textInputValue,
    onNext,
    onBack,
    canGoBack,
    onAnswer,
  ]);

  // Handle other input change
  const handleOtherInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setOtherInputValue(value);
    onOtherChange?.(value);
  };

  // Handle text input change
  const handleTextInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTextInputValue(e.target.value);
  };

  // Handle text input submit
  const handleTextInputSubmit = () => {
    if (textInputValue.trim()) {
      onAnswer(textInputValue.trim());
      onNext();
    }
  };

  // Calculate progress
  const progress = (questionNumber / totalQuestions) * 100;

  // Check if we can proceed
  const canProceed = question.type === 'text'
    ? textInputValue.trim().length > 0
    : question.type === 'multi'
    ? Array.isArray(currentAnswer) && currentAnswer.length > 0
    : !!currentAnswer;

  // Get transition classes based on state
  const getTransitionClasses = () => {
    switch (transitionState) {
      case 'entering':
        return 'opacity-0 translate-x-8';
      case 'exiting':
        return 'opacity-0 -translate-x-8';
      case 'visible':
      default:
        return 'opacity-100 translate-x-0';
    }
  };

  // Render option card
  const renderOptionCard = (option: QuestionOption, index: number) => {
    const IconComponent = option.icon ? iconMap[option.icon] : null;
    const selected = isSelected(option.value);
    const isPulsing = selectedAnimation === option.value;

    // Calculate stagger delay for entrance animation
    const staggerDelay = index * 50;

    return (
      <button
        key={option.value}
        onClick={() => handleOptionClick(option.value)}
        style={{
          animationDelay: cardsVisible ? `${staggerDelay}ms` : '0ms',
          animation: isPulsing ? 'pulse-select 150ms ease-out' : undefined,
        }}
        className={`
          w-full min-h-[80px] p-4 rounded-xl border-2 transition-all duration-200
          group flex items-center gap-4 text-left
          ${cardsVisible ? 'animate-[fade-in-up_300ms_ease-out_forwards]' : 'opacity-0'}
          ${selected
            ? 'border-indigo-500 bg-indigo-500/20 shadow-lg shadow-indigo-500/20'
            : 'border-slate-700 bg-slate-800/50 hover:border-indigo-400/50 hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/50'
          }
          hover:scale-[1.02]
        `}
      >
        {/* Keyboard shortcut indicator */}
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0 transition-all duration-200 ${
            selected
              ? 'bg-indigo-500 text-white'
              : 'bg-slate-700 text-slate-400 group-hover:bg-slate-600 group-hover:text-slate-300'
          }`}
        >
          {question.type === 'multi' && selected ? (
            <Check size={16} className="animate-[fade-in-up_150ms_ease-out]" />
          ) : (
            index + 1
          )}
        </div>

        {/* Icon */}
        {IconComponent && (
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 ${
              selected ? 'bg-indigo-500/30' : 'bg-slate-700/50 group-hover:bg-slate-600/50'
            }`}
          >
            <IconComponent
              size={24}
              className={`transition-colors duration-200 ${selected ? 'text-indigo-300' : 'text-slate-400 group-hover:text-slate-300'}`}
            />
          </div>
        )}

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <p
            className={`font-semibold text-base ${
              selected ? 'text-white' : 'text-slate-200 group-hover:text-white'
            }`}
          >
            {t(option.label)}
          </p>
          {option.description && (
            <p
              className={`text-sm mt-1 ${
                selected ? 'text-indigo-300' : 'text-slate-400 group-hover:text-slate-300'
              }`}
            >
              {t(option.description)}
            </p>
          )}
        </div>

        {/* Selection indicator for single select */}
        {question.type === 'single' && (
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
              selected
                ? 'border-indigo-500 bg-indigo-500'
                : 'border-slate-600 group-hover:border-slate-500'
            }`}
          >
            {selected && <div className="w-2 h-2 rounded-full bg-white" />}
          </div>
        )}
      </button>
    );
  };

  return (
    <>
      {/* Inject animation styles */}
      <style>{animationStyles}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 flex flex-col overflow-hidden relative">
        {/* Animated gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl"
            style={{ animation: 'float-orb-1 20s ease-in-out infinite' }}
          />
          <div
            className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-purple-600/10 blur-3xl"
            style={{ animation: 'float-orb-2 25s ease-in-out infinite' }}
          />
          <div
            className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full bg-indigo-500/5 blur-2xl"
            style={{ animation: 'float-orb-3 18s ease-in-out infinite' }}
          />
        </div>

        {/* Progress bar */}
        <div className="fixed top-0 left-0 right-0 h-1.5 bg-slate-800/80 z-20 backdrop-blur-sm">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400 transition-all duration-500 ease-out relative"
            style={{ width: `${progress}%` }}
          >
            {/* Glow effect on leading edge */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-4 bg-indigo-400 blur-md" />
          </div>
        </div>

        {/* Main content - Split screen layout */}
        <div className={`flex-1 flex flex-col md:flex-row transition-all duration-300 ease-out ${getTransitionClasses()}`}>
          {/* Left Panel - Question text (40% on desktop) */}
          <div className="md:w-[40%] flex flex-col justify-center px-6 py-8 md:px-12 md:py-16 relative z-10">
            {/* Back button and progress */}
            <div className="mb-8">
              <button
                onClick={onBack}
                disabled={!canGoBack}
                className={`flex items-center gap-2 text-sm font-medium transition-all mb-4 ${
                  canGoBack
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-700 cursor-not-allowed'
                }`}
              >
                <ChevronLeft size={18} />
                {t('common.back')}
              </button>

              <div className="text-slate-500 text-sm font-medium">
                {t('onboarding.questionProgress', { current: questionNumber, total: totalQuestions })}
              </div>
            </div>

            {/* Question text */}
            <div className="space-y-4">
              <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
                {t(question.title)}
              </h1>
              {question.subtitle && (
                <p className="text-lg text-slate-400">{t(question.subtitle)}</p>
              )}
              {question.type === 'multi' && (
                <p className="text-sm text-indigo-400 font-medium">{t('onboarding.selectAllThatApply')}</p>
              )}
            </div>

            {/* Keyboard hints - Desktop only */}
            <div className="mt-auto pt-8 text-xs text-slate-600 hidden md:block">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-slate-800/60 rounded text-slate-500 font-mono">1-9</kbd>
                  <span>{t('onboarding.select')}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-slate-800/60 rounded text-slate-500 font-mono">Enter</kbd>
                  <span>{t('onboarding.continue')}</span>
                </span>
                {canGoBack && (
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 bg-slate-800/60 rounded text-slate-500 font-mono">Esc</kbd>
                    <span>{t('common.back')}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Options (60% on desktop) */}
          <div className="md:w-[60%] flex flex-col justify-center px-6 py-4 md:px-12 md:py-16 relative z-10">
            {question.type === 'text' ? (
              /* Text input mode */
              <div className="w-full max-w-xl mx-auto space-y-4">
                <input
                  type="text"
                  value={textInputValue}
                  onChange={handleTextInputChange}
                  placeholder={t('onboarding.typeYourAnswer')}
                  autoFocus
                  className="w-full px-6 py-5 text-lg bg-slate-800/50 border-2 border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
                <button
                  onClick={handleTextInputSubmit}
                  disabled={!textInputValue.trim()}
                  className={`w-full py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2 ${
                    textInputValue.trim()
                      ? 'bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/30'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {t('onboarding.continue')}
                  <ChevronRight size={20} />
                </button>
              </div>
            ) : (
              /* Option cards */
              <div className="w-full max-w-2xl mx-auto">
                {/* 2-column grid on desktop, 1-column on mobile */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  {question.options.map((option, index) => renderOptionCard(option, index))}
                </div>

                {/* "Other" option */}
                {question.allowOther && (
                  <div className="mt-3 md:mt-4 space-y-2">
                    <button
                      onClick={() => handleOptionClick('other')}
                      style={{
                        animation: selectedAnimation === 'other' ? 'pulse-select 150ms ease-out' : undefined,
                      }}
                      className={`
                        w-full min-h-[80px] p-4 rounded-xl border-2 transition-all duration-200
                        group flex items-center gap-4 text-left
                        ${cardsVisible ? 'animate-[fade-in-up_300ms_ease-out_forwards]' : 'opacity-0'}
                        ${isSelected('other')
                          ? 'border-indigo-500 bg-indigo-500/20 shadow-lg shadow-indigo-500/20'
                          : 'border-slate-700 bg-slate-800/50 hover:border-indigo-400/50 hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/50'
                        }
                        hover:scale-[1.02]
                      `}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0 transition-all duration-200 ${
                          isSelected('other')
                            ? 'bg-indigo-500 text-white'
                            : 'bg-slate-700 text-slate-400 group-hover:bg-slate-600 group-hover:text-slate-300'
                        }`}
                      >
                        0
                      </div>

                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-semibold text-base ${
                            isSelected('other') ? 'text-white' : 'text-slate-200 group-hover:text-white'
                          }`}
                        >
                          {t('onboarding.other')}
                        </p>
                        <p className={`text-sm mt-1 ${isSelected('other') ? 'text-indigo-300' : 'text-slate-400'}`}>
                          {t('onboarding.specifyYourOwn')}
                        </p>
                      </div>

                      {question.type === 'single' && (
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                            isSelected('other')
                              ? 'border-indigo-500 bg-indigo-500'
                              : 'border-slate-600 group-hover:border-slate-500'
                          }`}
                        >
                          {isSelected('other') && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      )}
                    </button>

                    {/* Other text input */}
                    {isSelected('other') && (
                      <div className="pl-12 animate-[fade-in-up_200ms_ease-out]">
                        <input
                          type="text"
                          value={otherInputValue}
                          onChange={handleOtherInputChange}
                          placeholder={t('onboarding.pleaseSpecify')}
                          autoFocus
                          className="w-full px-4 py-3 text-sm bg-slate-800/50 border-2 border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Continue button for multi-select */}
                {question.type === 'multi' && (
                  <div className="mt-6 flex items-center justify-between">
                    <p className="text-sm text-slate-400">
                      {Array.isArray(currentAnswer) ? currentAnswer.length : 0} {t('onboarding.selected')}
                    </p>
                    <button
                      onClick={onNext}
                      disabled={!canProceed}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                        canProceed
                          ? 'bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/30'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {t('onboarding.continue')}
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default OnboardingQuestion;
