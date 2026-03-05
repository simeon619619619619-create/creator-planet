// =============================================================================
// Creator Preview Screen
// Shows a personalized mockup of the creator command center
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  ArrowRight,
  Users,
  BookOpen,
  MessageSquare,
  Calendar,
  Bot,
  TrendingUp,
  DollarSign,
  BarChart3,
} from 'lucide-react';

// =============================================================================
// Custom Hook: useCountUp - Animates a number from 0 to target
// =============================================================================
function useCountUp(target: number, duration: number = 1000, delay: number = 0): number {
  const [count, setCount] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const startAnimation = () => {
      const animate = (timestamp: number) => {
        if (startTimeRef.current === null) {
          startTimeRef.current = timestamp;
        }
        const elapsed = timestamp - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-out cubic function for smooth deceleration
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentCount = Math.round(easeOut * target);

        setCount(currentCount);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    };

    const timeoutId = setTimeout(startAnimation, delay);

    return () => {
      clearTimeout(timeoutId);
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [target, duration, delay]);

  return count;
}

interface PreviewScreenProps {
  niche: string | null;
  nicheOther: string | null;
  onContinue: () => void;
}

const PreviewScreen: React.FC<PreviewScreenProps> = ({
  niche,
  nicheOther,
  onContinue,
}) => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);

  // Trigger entrance animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Animated stat values with staggered delays
  const studentsCount = useCountUp(47, 800, 300);
  const revenueCount = useCountUp(2840, 1000, 500);
  const coursesCount = useCountUp(3, 800, 700);

  // Get niche display name
  const getNicheDisplay = (): string => {
    if (!niche) return t('onboarding.niches.default');
    if (niche === 'other' && nicheOther) return nicheOther;
    return t(`onboarding.niches.${niche}`, { defaultValue: t('onboarding.niches.default') });
  };

  const nicheDisplay = getNicheDisplay();
  const hubName = `${nicheDisplay} Hub`;

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Floating gradient orbs background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Large gradient orbs with subtle animation */}
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 h-1/3 bg-white/5 rounded-full blur-2xl animate-pulse" style={{ animationDuration: '6s' }} />
      </div>

      {/* Header with enhanced animation */}
      <div
        className={`text-center mb-4 relative z-10 transition-all duration-500 ease-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles
            size={24}
            className="text-[#666666] animate-pulse"
            style={{ animationDuration: '2s' }}
          />
          <span className="text-[#666666] text-sm font-medium tracking-wide uppercase">
            {t('onboarding.preview.ready', 'Ready')}
          </span>
          <Sparkles
            size={24}
            className="text-[#666666] animate-pulse"
            style={{ animationDuration: '2s' }}
          />
        </div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2">
          {t('onboarding.preview.title')}
        </h1>
        <p className="text-[#A0A0A0] text-sm md:text-base max-w-md mx-auto">
          {t('onboarding.preview.subtitle', { niche: nicheDisplay.toLowerCase() })}
        </p>
      </div>

      {/* Dashboard Mockup Card - Takes ~70% viewport height */}
      <div
        className={`w-full max-w-3xl relative z-10 transition-all duration-500 ease-out ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.9]'
        }`}
        style={{ transitionDelay: '150ms' }}
      >
        {/* Enhanced glow effect */}
        <div className="absolute -inset-4 bg-white/5 blur-3xl rounded-3xl opacity-70" />
        <div className="absolute -inset-1 bg-white/5 blur-xl rounded-2xl" />

        {/* Main mockup */}
        <div className="relative bg-[#0A0A0A]/95 rounded-xl border border-[#1F1F1F]/50 overflow-hidden backdrop-blur-sm" style={{ minHeight: '55vh', maxHeight: '70vh' }}>
          {/* Title bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#0A0A0A]/80 border-b border-[#1F1F1F]/50">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#EF4444]/80" />
                <div className="w-3 h-3 rounded-full bg-[#EAB308]/80" />
                <div className="w-3 h-3 rounded-full bg-[#22C55E]/80" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-white rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">C</span>
              </div>
              <span className="text-white font-semibold text-sm">{hubName}</span>
            </div>
            <div className="w-14" />
          </div>

          {/* Dashboard content */}
          <div className="flex flex-1">
            {/* Sidebar */}
            <div className="w-14 md:w-16 bg-[#0A0A0A]/60 border-r border-[#1F1F1F]/30 py-4 px-2 space-y-3">
              <div className="flex flex-col items-center p-2 rounded-lg bg-white/20 border border-[#333333]/30">
                <BarChart3 size={18} className="text-[#666666]" />
              </div>
              <div className="flex flex-col items-center p-2 rounded-lg hover:bg-[#151515]/30 transition-colors">
                <Users size={18} className="text-[#666666]" />
              </div>
              <div className="flex flex-col items-center p-2 rounded-lg hover:bg-[#151515]/30 transition-colors">
                <BookOpen size={18} className="text-[#666666]" />
              </div>
              <div className="flex flex-col items-center p-2 rounded-lg hover:bg-[#151515]/30 transition-colors">
                <MessageSquare size={18} className="text-[#666666]" />
              </div>
              <div className="flex flex-col items-center p-2 rounded-lg hover:bg-[#151515]/30 transition-colors">
                <Calendar size={18} className="text-[#666666]" />
              </div>
              <div className="flex flex-col items-center p-2 rounded-lg hover:bg-[#151515]/30 transition-colors">
                <Bot size={18} className="text-[#666666]" />
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 p-4 md:p-6 flex flex-col">
              {/* Welcome header */}
              <div className="mb-4 md:mb-6">
                <h2 className="text-base md:text-lg font-semibold text-white">
                  {t('onboarding.preview.welcomeBack')}
                </h2>
                <p className="text-[#666666] text-sm">
                  {t('onboarding.preview.businessDoingToday', { niche: nicheDisplay.toLowerCase() })}
                </p>
              </div>

              {/* Stats cards with animated counting */}
              <div className="grid grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
                {/* Revenue */}
                <div className="bg-[#0A0A0A]/60 rounded-xl p-3 md:p-4 border border-[#1F1F1F]/30 hover:border-[#333333]/30 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <DollarSign size={16} className="text-[#666666] md:hidden" />
                      <DollarSign size={20} className="text-[#666666] hidden md:block" />
                    </div>
                  </div>
                  <div className="text-2xl md:text-3xl font-bold text-white tabular-nums">${revenueCount.toLocaleString()}</div>
                  <div className="text-xs text-[#666666] mt-1">{t('onboarding.preview.monthlyRevenue', 'Monthly Revenue')}</div>
                </div>

                {/* Students */}
                <div className="bg-[#0A0A0A]/60 rounded-xl p-3 md:p-4 border border-[#1F1F1F]/30 hover:border-[#1F1F1F]/30 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <Users size={16} className="text-[#666666] md:hidden" />
                      <Users size={20} className="text-[#666666] hidden md:block" />
                    </div>
                  </div>
                  <div className="text-2xl md:text-3xl font-bold text-white tabular-nums">{studentsCount}</div>
                  <div className="text-xs text-[#666666] mt-1">{t('onboarding.preview.activeStudents')}</div>
                </div>

                {/* Courses */}
                <div className="bg-[#0A0A0A]/60 rounded-xl p-3 md:p-4 border border-[#1F1F1F]/30 hover:border-[#333333]/30 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <BookOpen size={16} className="text-[#22C55E] md:hidden" />
                      <BookOpen size={20} className="text-[#22C55E] hidden md:block" />
                    </div>
                  </div>
                  <div className="text-2xl md:text-3xl font-bold text-white tabular-nums">{coursesCount}</div>
                  <div className="text-xs text-[#666666] mt-1">{t('onboarding.preview.coursesCount')}</div>
                </div>
              </div>

              {/* AI Success Manager Insight - larger */}
              <div className="bg-[#1F1F1F]/20 rounded-xl p-4 border border-[#333333]/20 mt-auto">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 md:w-14 md:h-14 bg-white/30 rounded-lg flex items-center justify-center shrink-0">
                    <Bot size={20} className="text-[#666666] md:hidden" />
                    <Bot size={24} className="text-[#666666] hidden md:block" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm md:text-base font-medium text-white">
                      {t('onboarding.preview.aiInsightTitle', 'AI Success Manager')}
                    </p>
                    <p className="text-xs md:text-sm text-[#666666]">
                      {t('onboarding.preview.aiSuccessInsight')}
                    </p>
                  </div>
                  <TrendingUp size={18} className="text-[#22C55E] shrink-0 md:hidden" />
                  <TrendingUp size={22} className="text-[#22C55E] shrink-0 hidden md:block" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Continue Button */}
      <div
        className={`mt-6 relative z-10 transition-all duration-500 ease-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
        style={{ transitionDelay: '400ms' }}
      >
        <button
          onClick={onContinue}
          className="group px-8 py-3.5 bg-white hover:bg-[#E0E0E0] text-black font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 hover:scale-[1.02]"
        >
          <span>{t('onboarding.continue')}</span>
          <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
        </button>
      </div>

      {/* Hint text */}
      <p
        className={`mt-3 text-[#666666] text-sm relative z-10 transition-all duration-500 ease-out ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transitionDelay: '500ms' }}
      >
        {t('onboarding.preview.justPreview')}
      </p>
    </div>
  );
};

export default PreviewScreen;
