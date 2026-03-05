// =============================================================================
// Student Summary Screen
// Split-screen layout with animated checkmarks and answer cards
// =============================================================================

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  CheckCircle,
  ArrowRight,
  Target,
  TrendingUp,
  AlertCircle,
  Brain,
} from 'lucide-react';
import type {
  InterestOption,
  GoalOption,
  ChallengeOption,
  LearningStyleOption,
} from '../studentOnboardingTypes';

interface StudentSummaryScreenProps {
  interest: InterestOption | null;
  interestOther: string | null;
  goal: GoalOption | null;
  challenge: ChallengeOption | null;
  challengeOther: string | null;
  learningStyle: LearningStyleOption | null;
  onCreateAccount: () => void;
}

// =============================================================================
// Answer Card Component
// =============================================================================
interface AnswerCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  accentColor: string;
  delay: number;
  isVisible: boolean;
}

const AnswerCard: React.FC<AnswerCardProps> = ({
  icon,
  label,
  value,
  accentColor,
  delay,
  isVisible,
}) => {
  return (
    <div
      className={`bg-[#0A0A0A]/60 backdrop-blur-sm rounded-xl p-4 border border-[#1F1F1F]/50 hover:border-[#1F1F1F]/70 transition-all duration-500 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accentColor}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[#666666] uppercase tracking-wide mb-1">
            {label}
          </p>
          <p className="text-white font-semibold truncate">{value}</p>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Animated Checkmark Component
// =============================================================================
interface AnimatedCheckProps {
  text: string;
  delay: number;
  isVisible: boolean;
}

const AnimatedCheck: React.FC<AnimatedCheckProps> = ({ text, delay, isVisible }) => {
  return (
    <div
      className={`flex items-center gap-3 transition-all duration-500 ease-out ${
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="relative">
        <CheckCircle
          size={24}
          className="text-[#666666]"
          style={{
            strokeDasharray: 100,
            strokeDashoffset: isVisible ? 0 : 100,
            transition: `stroke-dashoffset 600ms ease-out ${delay}ms`,
          }}
        />
        <div className="absolute inset-0 bg-[#1F1F1F]/30 rounded-full blur-sm" />
      </div>
      <span className="text-[#A0A0A0] text-sm">{text}</span>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================
const StudentSummaryScreen: React.FC<StudentSummaryScreenProps> = ({
  interest,
  interestOther,
  goal,
  challenge,
  challengeOther,
  learningStyle,
  onCreateAccount,
}) => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const getInterestTitle = (): string => {
    if (interest === 'other' && interestOther) {
      return interestOther.charAt(0).toUpperCase() + interestOther.slice(1);
    }
    if (!interest) return t('studentOnboarding.interests.default');
    return t(`studentOnboarding.interests.${interest}`);
  };

  const getGoalText = (): string => {
    if (!goal) return t('studentOnboarding.goals.default');
    return t(`studentOnboarding.goals.${goal}`);
  };

  const getChallengeText = (): string => {
    if (challenge === 'other' && challengeOther) return challengeOther;
    if (!challenge) return t('studentOnboarding.challenges.default');
    return t(`studentOnboarding.challenges.${challenge}`);
  };

  const getLearningStyleText = (): string => {
    if (!learningStyle) return t('studentOnboarding.summary.learningStyleBenefits.mix');
    return t(`studentOnboarding.summary.learningStyleBenefits.${learningStyle}`);
  };

  const interestTitle = getInterestTitle();
  const goalText = getGoalText();
  const challengeText = getChallengeText();
  const learningStyleText = getLearningStyleText();

  const answerCards = [
    {
      icon: <Target size={20} className="text-[#666666]" />,
      label: t('studentOnboarding.questions.interest.title', 'Interest'),
      value: interestTitle,
      accentColor: 'bg-white/20',
    },
    {
      icon: <TrendingUp size={20} className="text-[#666666]" />,
      label: t('studentOnboarding.questions.goal.title', 'Goal'),
      value: goalText,
      accentColor: 'bg-white/20',
    },
    {
      icon: <AlertCircle size={20} className="text-[#EAB308]" />,
      label: t('studentOnboarding.questions.challenge.title', 'Challenge'),
      value: challengeText,
      accentColor: 'bg-[#1F1F1F]',
    },
    {
      icon: <Brain size={20} className="text-[#666666]" />,
      label: t('studentOnboarding.questions.learningStyle.title', 'Learning Style'),
      value: learningStyleText,
      accentColor: 'bg-white/20',
    },
  ];

  const checkmarkItems = [
    t('studentOnboarding.summary.benefits.expertCreators'),
    t('studentOnboarding.summary.benefits.flexibleLearning'),
    t('studentOnboarding.summary.benefits.supportiveCommunity'),
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col md:flex-row relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 h-1/3 bg-white/5 rounded-full blur-2xl animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute top-1/4 right-1/4 w-1/4 h-1/4 bg-[#1F1F1F]/5 rounded-full blur-2xl animate-pulse" style={{ animationDuration: '12s' }} />
      </div>

      {/* Left Panel */}
      <div className="w-full md:w-2/5 flex flex-col justify-center px-6 py-8 md:px-10 md:py-12 relative z-10">
        <div className={`flex items-center gap-2 mb-4 transition-all duration-500 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <Sparkles size={24} className="text-[#666666] animate-pulse" style={{ animationDuration: '2s' }} />
          <span className="text-[#A0A0A0] text-sm font-medium tracking-wide uppercase">
            {t('studentOnboarding.summary.basedOnShared')}
          </span>
        </div>

        <div className={`mb-8 transition-all duration-500 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '100ms' }}>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-tight mb-3">
            {t('studentOnboarding.summary.youWantToLearn')}{' '}
            <span className="text-[#A0A0A0]">{interestTitle}</span>
          </h1>
          <p className="text-lg md:text-xl text-[#A0A0A0]">
            {t('studentOnboarding.summary.toAchieve')}{' '}
            <span className="text-white font-semibold">{goalText}</span>
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <p className={`text-[#666666] text-sm font-medium mb-3 transition-all duration-500 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDelay: '300ms' }}>
            Founders Club offers you:
          </p>
          {checkmarkItems.map((item, index) => (
            <AnimatedCheck key={index} text={item} delay={400 + index * 150} isVisible={isVisible} />
          ))}
        </div>

        <div className={`md:hidden transition-all duration-500 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '800ms' }}>
          <button onClick={onCreateAccount} className="group w-full py-3.5 px-6 bg-white hover:bg-[#E0E0E0] text-black font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02]">
            {t('studentOnboarding.summary.startLearningFree')}
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
          <div className="mt-4 flex items-center justify-center gap-3 text-xs text-[#666666]">
            <span>{t('studentOnboarding.summary.freeToJoin')}</span>
            <span className="w-1 h-1 bg-[#151515] rounded-full" />
            <span>{t('studentOnboarding.summary.thousandsLearning')}</span>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full md:w-3/5 flex flex-col justify-center px-6 py-8 md:px-10 md:py-12 relative z-10">
        <div className={`mb-6 transition-all duration-500 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`} style={{ transitionDelay: '200ms' }}>
          <h2 className="text-xl md:text-2xl font-semibold text-white mb-2">Your Learning Profile</h2>
          <p className="text-[#666666] text-sm">Personalized just for you based on your answers</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {answerCards.map((card, index) => (
            <AnswerCard key={index} icon={card.icon} label={card.label} value={card.value} accentColor={card.accentColor} delay={300 + index * 100} isVisible={isVisible} />
          ))}
        </div>

        <div className={`bg-[#0A0A0A]/40 backdrop-blur-sm rounded-xl p-5 border border-[#1F1F1F]/40 mb-6 transition-all duration-500 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '700ms' }}>
          <p className="text-sm text-[#A0A0A0] leading-relaxed">
            <span className="font-semibold text-white">Founders Club</span>{' '}
            {t('studentOnboarding.summary.connectsYouWith')}{' '}
            <span className="text-[#A0A0A0]">{interestTitle.toLowerCase()}</span>{' '}
            {t('studentOnboarding.summary.expertCreators')}{' '}
            <span className="text-white font-medium">{t('studentOnboarding.summary.achieveGoals')}</span>.
          </p>
        </div>

        <div className={`hidden md:block transition-all duration-500 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '850ms' }}>
          <button onClick={onCreateAccount} className="group w-full max-w-md py-3.5 px-6 bg-white hover:bg-[#E0E0E0] text-black font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02]">
            {t('studentOnboarding.summary.startLearningFree')}
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
          <div className="mt-4 flex items-center gap-3 text-xs text-[#666666]">
            <span>{t('studentOnboarding.summary.freeToJoin')}</span>
            <span className="w-1 h-1 bg-[#151515] rounded-full" />
            <span>{t('studentOnboarding.summary.thousandsLearning')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentSummaryScreen;
