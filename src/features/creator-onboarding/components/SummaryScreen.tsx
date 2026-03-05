// =============================================================================
// Creator Summary Screen
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
  Wrench,
} from 'lucide-react';

interface SummaryScreenProps {
  niche: string | null;
  nicheOther: string | null;
  goal: string | null;
  painPoint: string | null;
  painPointOther: string | null;
  currentTools: string[];
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
        {/* Glow effect */}
        <div className="absolute inset-0 bg-[#1F1F1F]/30 rounded-full blur-sm" />
      </div>
      <span className="text-[#A0A0A0] text-sm">{text}</span>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================
const SummaryScreen: React.FC<SummaryScreenProps> = ({
  niche,
  nicheOther,
  goal,
  painPoint,
  painPointOther,
  currentTools,
  onCreateAccount,
}) => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);

  // Trigger entrance animations on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Get niche title
  const getNicheTitle = (): string => {
    if (!niche) return t('onboarding.nicheTitles.default');
    if (niche === 'other' && nicheOther) {
      return nicheOther.charAt(0).toUpperCase() + nicheOther.slice(1);
    }
    return t(`onboarding.nicheTitles.${niche}`, { defaultValue: t('onboarding.nicheTitles.default') });
  };

  // Get goal display text
  const getGoalText = (): string => {
    if (!goal) return t('onboarding.goals.default');
    return t(`onboarding.goals.${goal}`, { defaultValue: t('onboarding.goals.default') });
  };

  // Get pain point display text
  const getPainPointText = (): string => {
    if (!painPoint) return t('onboarding.painPoints.default');
    if (painPoint === 'other' && painPointOther) return painPointOther.toLowerCase();
    return t(`onboarding.painPoints.${painPoint}`, { defaultValue: t('onboarding.painPoints.default') });
  };

  // Get tools replacement message
  const getToolsText = (): string => {
    const filteredTools = currentTools.filter((tool) => tool !== 'none' && tool !== 'other');

    if (filteredTools.length === 0) {
      if (currentTools.includes('none')) {
        return t('onboarding.tools.none');
      }
      return t('onboarding.tools.default');
    }

    const displayNames = filteredTools.map((tool) =>
      t(`onboarding.tools.${tool}`, { defaultValue: tool })
    );

    if (displayNames.length === 1) {
      return displayNames[0];
    } else if (displayNames.length === 2) {
      return `${displayNames[0]} ${t('common.and')} ${displayNames[1]}`;
    } else {
      const last = displayNames.pop();
      return `${displayNames.join(', ')}, ${t('common.and')} ${last}`;
    }
  };

  const nicheTitle = getNicheTitle();
  const goalText = getGoalText();
  const painPointText = getPainPointText();
  const toolsText = getToolsText();

  // Answer cards data with business-focused icons
  const answerCards = [
    {
      icon: <Target size={20} className="text-[#666666]" />,
      label: t('onboarding.questions.niche.title', 'Your Niche'),
      value: nicheTitle,
      accentColor: 'bg-white/20',
    },
    {
      icon: <TrendingUp size={20} className="text-[#666666]" />,
      label: t('onboarding.questions.goal.title', 'Your Goal'),
      value: goalText,
      accentColor: 'bg-white/20',
    },
    {
      icon: <AlertCircle size={20} className="text-amber-400" />,
      label: t('onboarding.questions.painPoint.title', 'Challenge'),
      value: painPointText,
      accentColor: 'bg-[#EAB308]/100/20',
    },
    {
      icon: <Wrench size={20} className="text-cyan-400" />,
      label: t('onboarding.questions.tools.title', 'Current Tools'),
      value: toolsText,
      accentColor: 'bg-cyan-500/20',
    },
  ];

  // Checkmark items with staggered delays
  const checkmarkItems = [
    t('onboarding.summary.benefits.allInOne'),
    t('onboarding.summary.benefits.aiTracking'),
    t('onboarding.summary.benefits.payments'),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0A0A] via-[#0A0A0A] to-[#0A0A0A] flex flex-col md:flex-row relative overflow-hidden">
      {/* Floating gradient orbs background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-white/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: '8s' }}
        />
        <div
          className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-white/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: '10s' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 h-1/3 bg-white/5 rounded-full blur-2xl animate-pulse"
          style={{ animationDuration: '6s' }}
        />
        {/* Additional floating orb */}
        <div
          className="absolute top-1/4 right-1/4 w-1/4 h-1/4 bg-[#1F1F1F]/5 rounded-full blur-2xl animate-pulse"
          style={{ animationDuration: '12s' }}
        />
      </div>

      {/* Left Panel - 40% on desktop */}
      <div className="w-full md:w-2/5 flex flex-col justify-center px-6 py-8 md:px-10 md:py-12 relative z-10">
        {/* Header with sparkles */}
        <div
          className={`flex items-center gap-2 mb-4 transition-all duration-500 ease-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
          }`}
        >
          <Sparkles
            size={24}
            className="text-[#666666] animate-pulse"
            style={{ animationDuration: '2s' }}
          />
          <span className="text-[#A0A0A0] text-sm font-medium tracking-wide uppercase">
            {t('onboarding.summary.basedOnShared')}
          </span>
        </div>

        {/* Personalization message */}
        <div
          className={`mb-8 transition-all duration-500 ease-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-tight mb-3">
            {t('onboarding.summary.youreA')}{' '}
            <span className="text-[#666666]">{nicheTitle}</span>
          </h1>
          <p className="text-lg md:text-xl text-[#A0A0A0]">
            {t('onboarding.summary.lookingTo')}{' '}
            <span className="text-white font-semibold">{goalText}</span>
          </p>
        </div>

        {/* Animated checkmarks */}
        <div className="space-y-4 mb-8">
          <p
            className={`text-[#666666] text-sm font-medium mb-3 transition-all duration-500 ease-out ${
              isVisible ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ transitionDelay: '300ms' }}
          >
            {t('onboarding.summary.foundersClubOffers', 'Founders Club offers you:')}
          </p>
          {checkmarkItems.map((item, index) => (
            <AnimatedCheck
              key={index}
              text={item}
              delay={400 + index * 150}
              isVisible={isVisible}
            />
          ))}
        </div>

        {/* CTA Button - visible on mobile only here, desktop shows it on right */}
        <div
          className={`md:hidden transition-all duration-500 ease-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '800ms' }}
        >
          <button
            onClick={onCreateAccount}
            className="group w-full py-3.5 px-6 bg-white hover:bg-[#E0E0E0] text-black font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02]"
          >
            {t('onboarding.summary.createFreeAccount')}
            <ArrowRight
              size={18}
              className="group-hover:translate-x-1 transition-transform"
            />
          </button>

          {/* Trust Signals */}
          <div className="mt-4 flex items-center justify-center gap-3 text-xs text-[#666666]">
            <span>{t('onboarding.summary.noCreditCard')}</span>
            <span className="w-1 h-1 bg-[#151515] rounded-full" />
            <span>{t('onboarding.summary.freeTrial')}</span>
          </div>
        </div>
      </div>

      {/* Right Panel - 60% on desktop */}
      <div className="w-full md:w-3/5 flex flex-col justify-center px-6 py-8 md:px-10 md:py-12 relative z-10">
        {/* Section header */}
        <div
          className={`mb-6 transition-all duration-500 ease-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          <h2 className="text-xl md:text-2xl font-semibold text-white mb-2">
            {t('onboarding.summary.yourCreatorProfile', 'Your Creator Profile')}
          </h2>
          <p className="text-[#666666] text-sm">
            {t('onboarding.summary.personalizedForYou', 'Personalized just for you based on your answers')}
          </p>
        </div>

        {/* Answer cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {answerCards.map((card, index) => (
            <AnswerCard
              key={index}
              icon={card.icon}
              label={card.label}
              value={card.value}
              accentColor={card.accentColor}
              delay={300 + index * 100}
              isVisible={isVisible}
            />
          ))}
        </div>

        {/* Value proposition card */}
        <div
          className={`bg-[#0A0A0A]/40 backdrop-blur-sm rounded-xl p-5 border border-[#1F1F1F]/40 mb-6 transition-all duration-500 ease-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '700ms' }}
        >
          <p className="text-sm text-[#A0A0A0] leading-relaxed">
            <span className="font-semibold text-white">Founders Club</span>{' '}
            {t('onboarding.summary.foundersClubReplaces')}{' '}
            <span className="text-[#666666]">{toolsText}</span>{' '}
            {t('onboarding.summary.withOnePlatform')}{' '}
            <span className="text-white font-medium">
              {t('onboarding.summary.neverLoseStudent')}
            </span>.
          </p>
        </div>

        {/* CTA Button - desktop only, hidden on mobile */}
        <div
          className={`hidden md:block transition-all duration-500 ease-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '850ms' }}
        >
          <button
            onClick={onCreateAccount}
            className="group w-full max-w-md py-3.5 px-6 bg-white hover:bg-[#E0E0E0] text-black font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02]"
          >
            {t('onboarding.summary.createFreeAccount')}
            <ArrowRight
              size={18}
              className="group-hover:translate-x-1 transition-transform"
            />
          </button>

          {/* Trust Signals */}
          <div className="mt-4 flex items-center gap-3 text-xs text-[#666666]">
            <span>{t('onboarding.summary.noCreditCard')}</span>
            <span className="w-1 h-1 bg-[#151515] rounded-full" />
            <span>{t('onboarding.summary.freeTrial')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryScreen;
