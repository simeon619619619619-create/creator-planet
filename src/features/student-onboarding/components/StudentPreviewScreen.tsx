// =============================================================================
// Student Preview Screen
// Shows a personalized mockup of the student learning experience
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  ArrowRight,
  BookOpen,
  Users,
  Trophy,
  Play,
  MessageCircle,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import type { InterestOption } from '../studentOnboardingTypes';

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

interface StudentPreviewScreenProps {
  interest: InterestOption | null;
  interestOther: string | null;
  onContinue: () => void;
}

const StudentPreviewScreen: React.FC<StudentPreviewScreenProps> = ({
  interest,
  interestOther,
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
  const coursesCount = useCountUp(3, 800, 300);
  const progressCount = useCountUp(67, 1000, 500);
  const pointsCount = useCountUp(450, 1200, 700);

  // Get interest display name
  const getInterestDisplay = (): string => {
    if (interest === 'other' && interestOther) return interestOther;
    if (!interest) return t('studentOnboarding.interests.default');
    return t(`studentOnboarding.interests.${interest}`);
  };

  const interestDisplay = getInterestDisplay();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle gradient background shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Large gradient orbs with subtle animation */}
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-emerald-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-cyan-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 h-1/3 bg-teal-500/5 rounded-full blur-2xl animate-pulse" style={{ animationDuration: '6s' }} />
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
            className="text-emerald-400 animate-pulse"
            style={{ animationDuration: '2s' }}
          />
          <span className="text-emerald-400 text-sm font-medium tracking-wide uppercase">
            {t('studentOnboarding.preview.ready', 'Ready')}
          </span>
          <Sparkles
            size={24}
            className="text-emerald-400 animate-pulse"
            style={{ animationDuration: '2s' }}
          />
        </div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2">
          {t('studentOnboarding.preview.title')}
        </h1>
        <p className="text-[#A0A0A0] text-sm md:text-base max-w-md mx-auto">
          {t('studentOnboarding.preview.subtitle', { interest: interestDisplay.toLowerCase() })}
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
        <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/30 via-teal-500/25 to-cyan-500/30 blur-3xl rounded-3xl opacity-70" />
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 blur-xl rounded-2xl" />

        {/* Main mockup */}
        <div className="relative bg-[#0A0A0A]/95 rounded-xl border border-[#1F1F1F]/50 overflow-hidden backdrop-blur-sm" style={{ minHeight: '55vh', maxHeight: '70vh' }}>
          {/* Title bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#0A0A0A]/80 border-b border-[#1F1F1F]/50">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#EF4444]/100/80" />
                <div className="w-3 h-3 rounded-full bg-[#EAB308]/100/80" />
                <div className="w-3 h-3 rounded-full bg-[#22C55E]/100/80" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-[#22C55E]/100 rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">C</span>
              </div>
              <span className="text-white font-semibold text-sm">{t('studentOnboarding.preview.myLearning')}</span>
            </div>
            <div className="w-14" />
          </div>

          {/* Dashboard content */}
          <div className="flex flex-1">
            {/* Sidebar */}
            <div className="w-14 md:w-16 bg-[#0A0A0A]/60 border-r border-[#1F1F1F]/30 py-4 px-2 space-y-3">
              <div className="flex flex-col items-center p-2 rounded-lg bg-emerald-600/20 border border-emerald-500/30">
                <BookOpen size={18} className="text-emerald-400" />
              </div>
              <div className="flex flex-col items-center p-2 rounded-lg hover:bg-[#151515]/30 transition-colors">
                <Users size={18} className="text-[#666666]" />
              </div>
              <div className="flex flex-col items-center p-2 rounded-lg hover:bg-[#151515]/30 transition-colors">
                <MessageCircle size={18} className="text-[#666666]" />
              </div>
              <div className="flex flex-col items-center p-2 rounded-lg hover:bg-[#151515]/30 transition-colors">
                <Calendar size={18} className="text-[#666666]" />
              </div>
              <div className="flex flex-col items-center p-2 rounded-lg hover:bg-[#151515]/30 transition-colors">
                <Trophy size={18} className="text-[#666666]" />
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 p-4 md:p-6 flex flex-col">
              {/* Welcome header */}
              <div className="mb-4 md:mb-6">
                <h2 className="text-base md:text-lg font-semibold text-white">
                  {t('studentOnboarding.preview.welcomeBack')}
                </h2>
                <p className="text-[#666666] text-sm">
                  {t('studentOnboarding.preview.continueJourney', { interest: interestDisplay.toLowerCase() })}
                </p>
              </div>

              {/* Stats cards with animated counting */}
              <div className="grid grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
                {/* Courses */}
                <div className="bg-[#0A0A0A]/60 rounded-xl p-3 md:p-4 border border-[#1F1F1F]/30 hover:border-emerald-500/30 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-[#22C55E]/100/20 rounded-lg flex items-center justify-center">
                      <BookOpen size={16} className="text-emerald-400 md:hidden" />
                      <BookOpen size={20} className="text-emerald-400 hidden md:block" />
                    </div>
                  </div>
                  <div className="text-2xl md:text-3xl font-bold text-white tabular-nums">{coursesCount}</div>
                  <div className="text-xs text-[#666666] mt-1">{t('studentOnboarding.preview.enrolledCourses')}</div>
                </div>

                {/* Progress */}
                <div className="bg-[#0A0A0A]/60 rounded-xl p-3 md:p-4 border border-[#1F1F1F]/30 hover:border-cyan-500/30 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                      <TrendingUp size={16} className="text-cyan-400 md:hidden" />
                      <TrendingUp size={20} className="text-cyan-400 hidden md:block" />
                    </div>
                  </div>
                  <div className="text-2xl md:text-3xl font-bold text-white tabular-nums">{progressCount}%</div>
                  <div className="text-xs text-[#666666] mt-1">{t('studentOnboarding.preview.avgProgress')}</div>
                </div>

                {/* Points */}
                <div className="bg-[#0A0A0A]/60 rounded-xl p-3 md:p-4 border border-[#1F1F1F]/30 hover:border-amber-500/30 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-[#EAB308]/100/20 rounded-lg flex items-center justify-center">
                      <Trophy size={16} className="text-amber-400 md:hidden" />
                      <Trophy size={20} className="text-amber-400 hidden md:block" />
                    </div>
                  </div>
                  <div className="text-2xl md:text-3xl font-bold text-white tabular-nums">{pointsCount}</div>
                  <div className="text-xs text-[#666666] mt-1">{t('studentOnboarding.preview.pointsEarned')}</div>
                </div>
              </div>

              {/* Continue learning card - larger */}
              <div className="bg-gradient-to-r from-emerald-600/20 to-teal-600/20 rounded-xl p-4 border border-emerald-500/20 mt-auto">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-14 md:w-24 md:h-16 bg-[#151515] rounded-lg flex items-center justify-center shrink-0">
                    <Play size={20} className="text-emerald-400 md:hidden" />
                    <Play size={24} className="text-emerald-400 hidden md:block" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm md:text-base font-medium text-white truncate">
                      {t('studentOnboarding.preview.continueLearning')}
                    </p>
                    <p className="text-xs md:text-sm text-[#666666]">
                      {t('studentOnboarding.preview.lesson5of12')}
                    </p>
                  </div>
                  <ArrowRight size={18} className="text-emerald-400 shrink-0 md:hidden" />
                  <ArrowRight size={22} className="text-emerald-400 shrink-0 hidden md:block" />
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
          className="group px-8 py-3.5 bg-emerald-600 hover:bg-[#22C55E]/100 text-white font-semibold rounded-xl shadow-emerald-500/30 transition-all duration-200 flex items-center gap-2 hover:scale-[1.02]"
        >
          <span>{t('studentOnboarding.continue')}</span>
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
        {t('studentOnboarding.preview.justPreview')}
      </p>
    </div>
  );
};

export default StudentPreviewScreen;
