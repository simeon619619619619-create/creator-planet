import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Check,
  Zap,
  Users,
  BookOpen,
  Calendar,
  Brain,
  MessageSquare,
  BarChart3,
  Shield,
  Sparkles,
  Star,
  Github,
  Twitter,
  Linkedin,
  AlertTriangle,
  X,
  Heart,
  Target,
  Trophy,
  Layers,
  GraduationCap,
  Play,
  ChevronLeft,
  ChevronRight,
  Quote,
  TrendingUp,
  Globe,
  Menu
} from 'lucide-react';
import { Logo } from '../shared/Logo';
import LanguageSwitcher from '../shared/LanguageSwitcher';
import { supabase } from '../core/supabase/client';

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

// Hook for scroll-triggered animations
const useScrollAnimation = (threshold = 0.1) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
};

// Hook for animated counter
const useAnimatedCounter = (end: number, duration: number = 2000, startOnView: boolean = true) => {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!startOnView) {
      setHasStarted(true);
    }
  }, [startOnView]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current && startOnView) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [startOnView, hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;

    let startTime: number;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }, [hasStarted, end, duration]);

  return { count, ref };
};

// ============================================================================
// ANIMATION COMPONENTS
// ============================================================================

const FadeInSection: React.FC<{
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  className?: string;
}> = ({ children, delay = 0, direction = 'up', className = '' }) => {
  const { ref, isVisible } = useScrollAnimation();

  const directionClasses = {
    up: 'translate-y-8',
    down: '-translate-y-8',
    left: 'translate-x-8',
    right: '-translate-x-8',
  };

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${className} ${
        isVisible
          ? 'opacity-100 translate-x-0 translate-y-0'
          : `opacity-0 ${directionClasses[direction]}`
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

// Floating animation component
const FloatingElement: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({
  children,
  delay = 0,
  className = ''
}) => (
  <div
    className={`animate-float ${className}`}
    style={{ animationDelay: `${delay}ms` }}
  >
    {children}
  </div>
);

// ============================================================================
// MARKETING LANDING PAGE
// ============================================================================

const MarketingLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [realStats, setRealStats] = useState({ creators: 0, students: 0, courses: 0, communities: 0 });

  // Load real stats from database
  useEffect(() => {
    async function loadStats() {
      try {
        const [creatorsRes, studentsRes, coursesRes, communitiesRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'creator'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
          supabase.from('courses').select('id', { count: 'exact', head: true }),
          supabase.from('communities').select('id', { count: 'exact', head: true }).eq('is_public', true),
        ]);
        setRealStats({
          creators: creatorsRes.count || 0,
          students: studentsRes.count || 0,
          courses: coursesRes.count || 0,
          communities: communitiesRes.count || 0,
        });
      } catch (err) {
        console.error('Failed to load stats:', err);
      }
    }
    loadStats();
  }, []);

  const handleGetStarted = () => {
    navigate('/signup');
  };

  // Platform chaos tools
  const chaosTools = [
    { name: 'Telegram', color: '', icon: '✈️' },
    { name: 'Viber', color: '', icon: '📱' },
    { name: 'Skool', color: '', icon: '🎓' },
    { name: 'Discord', color: '', icon: '💬' },
    { name: 'Kajabi', color: '', icon: '📚' },
    { name: 'Calendly', color: '', icon: '📅' },
    { name: 'Zapier', color: '', icon: '⚡' },
    { name: 'Whop', color: '', icon: '🛒' },
  ];

  // Five pillars with enhanced data - use translation keys
  const pillars = [
    {
      icon: MessageSquare,
      id: 'communityHub',
      color: '',
    },
    {
      icon: BookOpen,
      id: 'courseLms',
      color: '',
    },
    {
      icon: Calendar,
      id: 'eventsBooking',
      color: '',
    },
    {
      icon: Brain,
      id: 'aiSuccessManager',
      color: '',
    },
    {
      icon: BarChart3,
      id: 'analytics',
      color: '',
    },
  ];

  // Testimonials - use translation keys
  const testimonialIds = ['maria', 'georgi', 'elena'];
  const testimonialGradients = [
    '',
    '',
    '',
  ];
  const testimonialAvatars = ['MI', 'ГП', 'ЕД'];

  // Stats for social proof - only show real data
  const hasRealStats = realStats.creators > 0 || realStats.students > 0 || realStats.courses > 0 || realStats.communities > 0;
  const stats = [
    { label: t('marketingLanding.stats.creators'), value: realStats.creators, suffix: '', icon: Users },
    { label: t('marketingLanding.stats.students'), value: realStats.students, suffix: '', icon: GraduationCap },
    { label: t('marketingLanding.stats.courses'), value: realStats.courses, suffix: '', icon: BookOpen },
    { label: t('marketingLanding.stats.communities'), value: realStats.communities, suffix: '', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] overflow-hidden">
      {/* Custom CSS for animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(5deg); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 8s ease-in-out infinite; }
        .glass-card {
          background: rgba(10, 10, 10, 0.8);
          backdrop-filter: blur(20px);
          border: 1px solid #1F1F1F;
        }
        .glass-dark {
          background: rgba(10, 10, 10, 0.8);
          backdrop-filter: blur(20px);
          border: 1px solid #1F1F1F;
        }
        .text-gradient {
          color: #FAFAFA;
        }
        .shimmer-btn {
          position: relative;
          overflow: hidden;
        }
        .shimmer-btn::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          animation: shimmer 2s infinite;
        }
      `}</style>

      {/* Navigation - Glassmorphism */}
      <nav className="fixed top-0 w-full glass-card z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Logo variant="light" size="sm" showText={false} />
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#pillars" className="text-[#A0A0A0] hover:text-[#FAFAFA] transition-colors font-medium">{t('marketingLanding.nav.pillars')}</a>
              <a href="#pricing" className="text-[#A0A0A0] hover:text-[#FAFAFA] transition-colors font-medium">{t('marketingLanding.nav.pricing')}</a>
              <a href="#testimonials" className="text-[#A0A0A0] hover:text-[#FAFAFA] transition-colors font-medium">{t('marketingLanding.nav.testimonials')}</a>
              <LanguageSwitcher variant="minimal" />
              <button
                onClick={handleGetStarted}
                className="shimmer-btn bg-white hover:bg-[#E0E0E0] text-black px-6 py-2 rounded-lg font-semibold transition-all duration-150"
              >
                {t('marketingLanding.nav.getStarted')}
              </button>
            </div>

            {/* Mobile Navigation Controls */}
            <div className="flex md:hidden items-center gap-3">
              <LanguageSwitcher variant="minimal" />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-[#A0A0A0] hover:text-[#FAFAFA] transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-[#1F1F1F]/50 py-4 bg-[#0A0A0A]/95 backdrop-blur-md">
              <div className="flex flex-col gap-4">
                <a
                  href="#pillars"
                  className="text-[#A0A0A0] hover:text-[#FAFAFA] transition-colors px-2 py-2 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('marketingLanding.nav.pillars')}
                </a>
                <a
                  href="#pricing"
                  className="text-[#A0A0A0] hover:text-[#FAFAFA] transition-colors px-2 py-2 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('marketingLanding.nav.pricing')}
                </a>
                <a
                  href="#testimonials"
                  className="text-[#A0A0A0] hover:text-[#FAFAFA] transition-colors px-2 py-2 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('marketingLanding.nav.testimonials')}
                </a>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleGetStarted();
                  }}
                  className="shimmer-btn bg-white hover:bg-[#E0E0E0] text-black px-6 py-3 rounded-lg font-semibold transition-all duration-150 text-center"
                >
                  {t('marketingLanding.nav.getStarted')}
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* ========================================================================
          HERO SECTION - With mesh gradient and floating elements
      ======================================================================== */}
      <section className="relative pt-32 pb-20 px-4 bg-[#0A0A0A] min-h-screen flex items-center">
        {/* Floating decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <FloatingElement delay={0} className="absolute top-20 left-10 w-20 h-20 bg-white/5 rounded-full blur-xl" />
          <FloatingElement delay={1000} className="absolute top-40 right-20 w-32 h-32 bg-white/5 rounded-full blur-xl" />
          <FloatingElement delay={2000} className="absolute bottom-40 left-1/4 w-24 h-24 bg-white/5 rounded-full blur-xl" />
          <FloatingElement delay={500} className="absolute bottom-20 right-1/3 w-16 h-16 bg-white/5 rounded-full blur-xl" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <FadeInSection delay={0}>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-[#0A0A0A]/80 backdrop-blur-sm text-[#FAFAFA] px-5 py-2.5 rounded-full text-sm font-semibold mb-8  border border-[#1F1F1F]">
                <Sparkles size={16} className="text-[#A0A0A0]" />
                <span>{t('marketingLanding.heroBadge')}</span>
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-[#A0A0A0] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#A0A0A0]"></span>
                </span>
              </div>
            </FadeInSection>

            <FadeInSection delay={100}>
              {/* Headline */}
              <h1 className="text-5xl md:text-7xl font-bold text-[#FAFAFA] mb-6 leading-tight">
                {t('marketingLanding.heroTitle')}{' '}
                <span className="text-gradient animate-gradient">
                  {t('marketingLanding.heroTitleHighlight')}
                </span>
              </h1>
            </FadeInSection>

            <FadeInSection delay={200}>
              {/* Subheadline */}
              <p className="text-xl md:text-2xl text-[#A0A0A0] mb-10 leading-relaxed max-w-3xl mx-auto">
                {t('marketingLanding.heroSubtitle1')} <span className="font-semibold text-[#FAFAFA]">{t('marketingLanding.heroSubtitle2')}</span> {t('marketingLanding.heroSubtitle3')}{' '}
                <span className="font-semibold text-[#FAFAFA]">{t('marketingLanding.heroSubtitle4')}</span>
                {t('marketingLanding.heroSubtitle5')}
              </p>
            </FadeInSection>

            <FadeInSection delay={300}>
              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <button
                  onClick={handleGetStarted}
                  className="group shimmer-btn bg-white hover:bg-[#E0E0E0] text-black px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-150 flex items-center justify-center gap-2"
                >
                  {t('marketingLanding.startFree')}
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <button className="group bg-[#0A0A0A] hover:bg-[#E0E0E0] text-[#FAFAFA] px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 border-2 border-[#1F1F1F] hover:border-[#333333] flex items-center justify-center gap-2 hover:-translate-y-1">
                  <Play size={20} className="text-[#FAFAFA]" />
                  {t('marketingLanding.watchDemo')}
                </button>
              </div>
            </FadeInSection>

            <FadeInSection delay={400}>
              {/* Trust Indicators */}
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#A0A0A0]">
                <div className="flex items-center gap-2 bg-[#0A0A0A]/60 backdrop-blur-sm px-4 py-2 rounded-full">
                  <Check className="text-[#22C55E]" size={18} />
                  {t('marketingLanding.noCardRequired')}
                </div>
                <div className="flex items-center gap-2 bg-[#0A0A0A]/60 backdrop-blur-sm px-4 py-2 rounded-full">
                  <Check className="text-[#22C55E]" size={18} />
                  {t('marketingLanding.readyInMinutes')}
                </div>
                <div className="flex items-center gap-2 bg-[#0A0A0A]/60 backdrop-blur-sm px-4 py-2 rounded-full">
                  <Check className="text-[#22C55E]" size={18} />
                  {t('marketingLanding.cancelAnytime')}
                </div>
              </div>
            </FadeInSection>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-[#333333] rounded-full flex justify-center pt-2">
            <div className="w-1.5 h-3 bg-[#666666] rounded-full animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* ========================================================================
          SOCIAL PROOF - Animated Counters (only show if we have real data)
      ======================================================================== */}
      {hasRealStats && (
        <section className="py-16 px-4 bg-[#0A0A0A] relative overflow-hidden">
          <div className="absolute inset-0 bg-white/5"></div>
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.filter(stat => stat.value > 0).map((stat, index) => {
                const { count, ref } = useAnimatedCounter(stat.value);
                return (
                  <FadeInSection key={stat.label} delay={index * 100}>
                    <div className="text-center group">
                      <div className="w-14 h-14 mx-auto mb-4 bg-[#1F1F1F] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <stat.icon className="text-[#A0A0A0]" size={28} />
                      </div>
                      <div className="text-4xl md:text-5xl font-bold text-white mb-2">
                        <span ref={ref}>{count.toLocaleString()}</span>
                        <span className="text-[#A0A0A0]">{stat.suffix}</span>
                      </div>
                      <p className="text-[#A0A0A0] font-medium">{stat.label}</p>
                    </div>
                  </FadeInSection>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================
          PAIN SECTION - Platform Chaos with animations
      ======================================================================== */}
      <section className="py-24 px-4 bg-[#0A0A0A] relative">
        <div className="max-w-7xl mx-auto">
          <FadeInSection>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-[#1F1F1F] text-[#EF4444] px-4 py-2 rounded-full text-sm font-semibold mb-6 border border-[#1F1F1F]">
                <AlertTriangle size={16} />
                {t('marketingLanding.platformChaos')}
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-[#FAFAFA] mb-4">
                {t('marketingLanding.platformChaosTitle')}{' '}
                <span className="text-[#EF4444]">{t('marketingLanding.platformChaosNightmare')}</span>?
              </h2>
              <p className="text-xl text-[#A0A0A0] max-w-3xl mx-auto">
                {t('marketingLanding.platformChaosSubtitle')}
              </p>
            </div>
          </FadeInSection>

          {/* Chaos Tools Grid - Bento Style */}
          <FadeInSection delay={200}>
            <div className="glass-card rounded-3xl p-8 md:p-12 mb-12 border border-[#1F1F1F] ">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                {chaosTools.map((tool, index) => (
                  <div
                    key={tool.name}
                    className="group bg-[#0A0A0A] rounded-2xl p-5 border-2 border-[#1F1F1F] hover:border-[#333333] transition-all duration-300 hover:-translate-y-1 hover: relative overflow-hidden"
                  >
                    <div className="w-12 h-12 bg-[#1F1F1F] rounded-xl mb-4 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                      {tool.icon}
                    </div>
                    <p className="font-bold text-[#FAFAFA]">{tool.name}</p>
                    <p className="text-sm text-[#666666]">~€15-50/мес</p>
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#A0A0A0] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-0 group-hover:scale-100">
                      <X size={12} className="text-white" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Pain Points with icons */}
              <div className="grid md:grid-cols-3 gap-6">
                <div className="flex items-center gap-4 bg-[#1F1F1F]/50 rounded-xl p-4">
                  <div className="w-12 h-12 bg-[#1F1F1F] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Zap className="text-[#EF4444]" size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-[#FAFAFA]">{t('marketingLanding.painPoints.hoursLost')}</p>
                    <p className="text-sm text-[#A0A0A0]">{t('marketingLanding.painPoints.hoursLostDesc')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 bg-[#1F1F1F]/50 rounded-xl p-4">
                  <div className="w-12 h-12 bg-[#1F1F1F] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Users className="text-[#A0A0A0]" size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-[#FAFAFA]">{t('marketingLanding.painPoints.lostStudents')}</p>
                    <p className="text-sm text-[#A0A0A0]">{t('marketingLanding.painPoints.lostStudentsDesc')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 bg-[#1F1F1F]/50 rounded-xl p-4">
                  <div className="w-12 h-12 bg-[#1F1F1F] rounded-xl flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="text-[#A0A0A0]" size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-[#FAFAFA]">{t('marketingLanding.painPoints.monthlySpend')}</p>
                    <p className="text-sm text-[#A0A0A0]">{t('marketingLanding.painPoints.monthlySpendDesc')}</p>
                  </div>
                </div>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ========================================================================
          PILLARS SECTION - Bento Grid Layout
      ======================================================================== */}
      <section id="pillars" className="py-24 px-4 bg-[#0A0A0A] relative overflow-hidden">
        <div className="absolute inset-0 bg-[#0A0A0A] opacity-30"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <FadeInSection>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-[#1F1F1F] text-[#FAFAFA] px-4 py-2 rounded-full text-sm font-semibold mb-6 border border-[#1F1F1F]">
                <Layers size={16} />
                {t('marketingLanding.fivePillars')}
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-[#FAFAFA] mb-4">
                {t('marketingLanding.fivePillarsTitle')}
              </h2>
              <p className="text-xl text-[#A0A0A0] max-w-3xl mx-auto">
                {t('marketingLanding.fivePillarsSubtitle')}
              </p>
            </div>
          </FadeInSection>

          {/* Bento Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Large card - AI Success Manager */}
            <FadeInSection delay={0} className="md:col-span-2 md:row-span-2">
              <div className="h-full glass-card rounded-3xl p-8 border border-[#1F1F1F]  hover: transition-all duration-500 group overflow-hidden relative">
                <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 transition-all duration-500"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-[#1F1F1F] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Brain className="text-white" size={32} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-[#FAFAFA]">{t('marketingLanding.pillars.aiSuccessManager.title')}</h3>
                      <p className="text-[#A0A0A0] font-medium">{t('marketingLanding.pillars.aiSuccessManager.subtitle')}</p>
                    </div>
                  </div>
                  <p className="text-lg text-[#A0A0A0] mb-8 leading-relaxed">
                    {t('marketingLanding.pillars.aiSuccessManager.description')}
                  </p>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="bg-[#0A0A0A]/80 rounded-xl p-4 border border-[#1F1F1F]">
                      <Target className="text-[#A0A0A0] mb-2" size={24} />
                      <p className="font-bold text-[#FAFAFA]">{t('marketingLanding.pillars.aiSuccessManager.riskScoring')}</p>
                      <p className="text-sm text-[#666666]">{t('marketingLanding.pillars.aiSuccessManager.riskScoringDesc')}</p>
                    </div>
                    <div className="bg-[#0A0A0A]/80 rounded-xl p-4 border border-[#1F1F1F]">
                      <Sparkles className="text-[#A0A0A0] mb-2" size={24} />
                      <p className="font-bold text-[#FAFAFA]">{t('marketingLanding.pillars.aiSuccessManager.smartAlerts')}</p>
                      <p className="text-sm text-[#666666]">{t('marketingLanding.pillars.aiSuccessManager.smartAlertsDesc')}</p>
                    </div>
                    <div className="bg-[#0A0A0A]/80 rounded-xl p-4 border border-[#1F1F1F]">
                      <BarChart3 className="text-[#A0A0A0] mb-2" size={24} />
                      <p className="font-bold text-[#FAFAFA]">{t('marketingLanding.pillars.aiSuccessManager.healthDashboard')}</p>
                      <p className="text-sm text-[#666666]">{t('marketingLanding.pillars.aiSuccessManager.healthDashboardDesc')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </FadeInSection>

            {/* Other pillars */}
            {pillars.filter(p => p.id !== 'aiSuccessManager').map((pillar, index) => (
              <FadeInSection key={pillar.id} delay={(index + 1) * 100}>
                <div className="h-full glass-card rounded-3xl p-6 border border-[#1F1F1F]  hover: transition-all duration-300 group hover:-translate-y-1">
                  <div className="w-14 h-14 bg-[#1F1F1F] rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <pillar.icon className="text-white" size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-[#FAFAFA] mb-2">{t(`marketingLanding.pillars.${pillar.id}.title`)}</h3>
                  <p className="text-[#A0A0A0] mb-4">{t(`marketingLanding.pillars.${pillar.id}.description`)}</p>
                  <div className="flex flex-wrap gap-2">
                    {(t(`marketingLanding.pillars.${pillar.id}.features`, { returnObjects: true }) as string[]).map((feature: string) => (
                      <span key={feature} className="text-xs bg-[#1F1F1F] text-[#A0A0A0] px-3 py-1 rounded-full">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              </FadeInSection>
            ))}
          </div>

          {/* Integration Note */}
          <FadeInSection delay={500}>
            <div className="mt-12 text-center">
              <div className="inline-flex items-center gap-3 bg-[#1F1F1F] text-[#22C55E] px-6 py-3 rounded-xl border border-[#1F1F1F]">
                <Check size={20} />
                <span className="font-semibold">{t('marketingLanding.allIntegrated')}</span>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ========================================================================
          PROMISE SECTION - AI Success Manager Deep Dive
      ======================================================================== */}
      <section className="py-24 px-4 bg-[#0A0A0A] border-t border-[#1F1F1F] text-white relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-float-slow"></div>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <FadeInSection>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-[#0A0A0A]/10 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-semibold mb-6 border border-white/20">
                <Brain size={16} />
                {t('marketingLanding.aiSection.badge')}
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                {t('marketingLanding.aiSection.title')}
              </h2>
              <p className="text-xl text-[#A0A0A0] max-w-3xl mx-auto">
                {t('marketingLanding.aiSection.subtitle')}
              </p>
            </div>
          </FadeInSection>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <FadeInSection direction="left">
              <div className="space-y-6">
                {[
                  { icon: Target, id: 'riskScoring', color: '' },
                  { icon: Sparkles, id: 'smartRecommendations', color: '' },
                  { icon: BarChart3, id: 'healthDashboard', color: '' },
                ].map((item) => (
                  <div key={item.id} className="glass-dark rounded-2xl p-6 hover:bg-[#0A0A0A]/10 transition-all duration-300 group">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-[#1F1F1F] rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                        <item.icon className="text-white" size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold mb-2">{t(`marketingLanding.aiSectionDetails.${item.id}.title`)}</h3>
                        <p className="text-[#A0A0A0]">{t(`marketingLanding.aiSectionDetails.${item.id}.description`)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </FadeInSection>

            <FadeInSection direction="right">
              <div className="glass-dark rounded-3xl p-8 border border-white/10">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-2 bg-[#0A0A0A]/10 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                    <Layers size={16} />
                    {t('marketingLanding.aiSectionDetails.osTitle')}
                  </div>
                  <h3 className="text-2xl font-bold">{t('marketingLanding.aiSectionDetails.osSubtitle')}</h3>
                </div>

                <div className="space-y-4">
                  <div className="bg-white/5 rounded-xl p-5 border border-[#1F1F1F] hover:border-[#333333] transition-colors duration-150">
                    <div className="flex items-center gap-3 mb-3">
                      <GraduationCap size={24} className="text-[#EAB308]" />
                      <span className="font-bold text-lg">{t('marketingLanding.aiSectionDetails.forCreator.title')}</span>
                    </div>
                    <p className="text-[#A0A0A0]">
                      {t('marketingLanding.aiSectionDetails.forCreator.description')}
                    </p>
                  </div>

                  <div className="bg-white/5 rounded-xl p-5 border border-[#1F1F1F] hover:border-[#333333] transition-colors duration-150">
                    <div className="flex items-center gap-3 mb-3">
                      <Users size={24} className="text-[#22C55E]" />
                      <span className="font-bold text-lg">{t('marketingLanding.aiSectionDetails.forStudent.title')}</span>
                    </div>
                    <p className="text-[#A0A0A0]">
                      {t('marketingLanding.aiSectionDetails.forStudent.description')}
                    </p>
                  </div>
                </div>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ========================================================================
          TESTIMONIALS - Carousel with stats
      ======================================================================== */}
      <section id="testimonials" className="py-24 px-4 bg-[#0A0A0A] relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <FadeInSection>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-[#1F1F1F] text-[#A0A0A0] px-4 py-2 rounded-full text-sm font-semibold mb-6 border border-[#1F1F1F]">
                <Star size={16} />
                {t('marketingLanding.testimonials.badge')}
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-[#FAFAFA] mb-4">
                {t('marketingLanding.testimonials.title')}
              </h2>
            </div>
          </FadeInSection>

          {/* Testimonial Carousel */}
          <FadeInSection delay={200}>
            <div className="relative max-w-4xl mx-auto">
              <div className="glass-card rounded-3xl p-8 md:p-12 border border-[#1F1F1F] ">
                <Quote className="text-[#A0A0A0] mb-6" size={48} />
                <p className="text-2xl text-[#A0A0A0] mb-8 leading-relaxed italic">
                  "{t(`marketingLanding.testimonials.items.${testimonialIds[currentTestimonial]}.quote`)}"
                </p>

                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-[#1F1F1F] rounded-full flex items-center justify-center text-[#FAFAFA] font-bold text-xl">
                    {testimonialAvatars[currentTestimonial]}
                  </div>
                  <div>
                    <p className="font-bold text-[#FAFAFA] text-lg">{t(`marketingLanding.testimonials.items.${testimonialIds[currentTestimonial]}.name`)}</p>
                    <p className="text-[#666666]">{t(`marketingLanding.testimonials.items.${testimonialIds[currentTestimonial]}.role`)}</p>
                    <div className="flex gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <Star key={i} size={14} className="text-[#EAB308] fill-[#EAB308]" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-center gap-4 mt-8">
                <button
                  onClick={() => setCurrentTestimonial(prev => prev === 0 ? testimonialIds.length - 1 : prev - 1)}
                  className="w-12 h-12 bg-[#1F1F1F] hover:bg-[#1F1F1F] rounded-full flex items-center justify-center transition-colors group"
                >
                  <ChevronLeft size={24} className="text-[#A0A0A0] group-hover:text-[#FAFAFA]" />
                </button>
                <div className="flex items-center gap-2">
                  {testimonialIds.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentTestimonial(index)}
                      className={`w-3 h-3 rounded-full transition-all duration-300 ${
                        index === currentTestimonial
                          ? 'bg-white w-8'
                          : 'bg-[#333333] hover:bg-[#555555]'
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setCurrentTestimonial(prev => prev === testimonialIds.length - 1 ? 0 : prev + 1)}
                  className="w-12 h-12 bg-[#1F1F1F] hover:bg-[#1F1F1F] rounded-full flex items-center justify-center transition-colors group"
                >
                  <ChevronRight size={24} className="text-[#A0A0A0] group-hover:text-[#FAFAFA]" />
                </button>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ========================================================================
          ORIGIN STORY
      ======================================================================== */}
      <section id="story" className="py-24 px-4 bg-[#0A0A0A]">
        <div className="max-w-4xl mx-auto">
          <FadeInSection>
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-[#1F1F1F] text-[#A0A0A0] px-4 py-2 rounded-full text-sm font-semibold mb-6 border border-[#1F1F1F]">
                <Heart size={16} />
                {t('marketingLanding.originStory.badge')}
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-[#FAFAFA] mb-4">
                {t('marketingLanding.originStory.title')}
              </h2>
            </div>
          </FadeInSection>

          <FadeInSection delay={200}>
            <div className="glass-card rounded-3xl p-8 md:p-12 border border-[#1F1F1F] ">
              <div className="prose prose-lg max-w-none text-[#A0A0A0]">
                <p className="text-xl leading-relaxed mb-6">
                  {t('marketingLanding.originStory.paragraph1')}
                </p>
                <p className="text-xl leading-relaxed mb-6">
                  <span className="font-semibold text-[#FAFAFA]">{t('marketingLanding.originStory.paragraph2prefix')}</span> {t('marketingLanding.originStory.paragraph2')}
                </p>
                <p className="text-xl leading-relaxed">
                  {t('marketingLanding.originStory.paragraph3prefix')} <span className="font-bold text-gradient">Founders Club</span> {t('marketingLanding.originStory.paragraph3suffix')}
                </p>
              </div>

              <div className="mt-8 pt-8 border-t border-[#1F1F1F] flex items-center gap-4">
                <div className="w-14 h-14 bg-[#1F1F1F] rounded-full flex items-center justify-center text-[#FAFAFA] font-bold text-lg">
                  CC
                </div>
                <div>
                  <p className="font-bold text-[#FAFAFA]">{t('marketingLanding.originStory.teamName')}</p>
                  <p className="text-[#666666]">{t('marketingLanding.originStory.teamDesc')}</p>
                </div>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ========================================================================
          PRICING - Glassmorphism cards
      ======================================================================== */}
      <section id="pricing" className="py-24 px-4 bg-[#0A0A0A] relative overflow-hidden">
        <div className="absolute inset-0 bg-[#0A0A0A] opacity-20"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <FadeInSection>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-[#1F1F1F] text-[#FAFAFA] px-4 py-2 rounded-full text-sm font-semibold mb-6 border border-[#1F1F1F]">
                <Trophy size={16} />
                {t('marketingLanding.pricing.badge')}
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-[#FAFAFA] mb-4">
                {t('marketingLanding.pricing.title')}
              </h2>
              <p className="text-xl text-[#A0A0A0] max-w-3xl mx-auto">
                {t('marketingLanding.pricing.subtitle')}
              </p>
            </div>
          </FadeInSection>

          {/* User Roles */}
          <FadeInSection delay={100}>
            <div className="glass-card rounded-2xl p-6 md:p-8 border border-[#1F1F1F] mb-12 max-w-4xl mx-auto ">
              <h3 className="text-xl font-bold text-[#FAFAFA] mb-4 text-center">{t('marketingLanding.pricing.userRoles.title')}</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex items-start gap-4 bg-[#1F1F1F]/50 rounded-xl p-4">
                  <div className="w-12 h-12 bg-[#1F1F1F] rounded-xl flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="text-white" size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-[#FAFAFA]">{t('marketingLanding.pricing.userRoles.creator.title')}</p>
                    <p className="text-sm text-[#A0A0A0]">
                      {t('marketingLanding.pricing.userRoles.creator.description')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4 bg-[#1F1F1F]/50 rounded-xl p-4">
                  <div className="w-12 h-12 bg-[#1F1F1F] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Users className="text-white" size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-[#FAFAFA]">{t('marketingLanding.pricing.userRoles.student.title')}</p>
                    <p className="text-sm text-[#A0A0A0]">
                      {t('marketingLanding.pricing.userRoles.student.description')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </FadeInSection>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
            {/* Starter */}
            <FadeInSection delay={200}>
              <div className="glass-card rounded-3xl p-8 border border-[#1F1F1F] hover:border-[#333333] transition-all duration-300 hover:-translate-y-2 hover: h-full flex flex-col">
                <div className="text-sm font-semibold text-[#FAFAFA] mb-2">{t('marketingLanding.pricing.starter.name')}</div>
                <div className="mb-6">
                  <div className="text-5xl font-bold text-[#FAFAFA] mb-2">
                    {t('marketingLanding.pricing.starter.price')}
                    <span className="text-lg text-[#666666] font-normal">{t('marketingLanding.pricing.perMonth')}</span>
                  </div>
                  <p className="text-[#A0A0A0]">{t('marketingLanding.pricing.starter.description')}</p>
                </div>
                <div className="mb-6 py-3 px-4 bg-[#1F1F1F] rounded-xl border border-[#1F1F1F]">
                  <p className="text-sm text-[#EAB308] font-semibold">{t('marketingLanding.pricing.starter.fee')} {t('marketingLanding.pricing.feeOnSale')}</p>
                </div>
                <ul className="space-y-4 mb-8 flex-grow">
                  {(t('marketingLanding.pricing.starter.features', { returnObjects: true }) as string[]).map((feature: string) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="text-[#22C55E] flex-shrink-0 mt-0.5" size={20} />
                      <span className="text-[#A0A0A0]">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleGetStarted}
                  className="w-full bg-[#0A0A0A] hover:bg-[#1F1F1F] text-white py-3 rounded-xl font-semibold transition-all duration-300 hover:"
                >
                  {t('marketingLanding.pricing.startFree')}
                </button>
              </div>
            </FadeInSection>

            {/* Pro - Featured */}
            <FadeInSection delay={300}>
              <div className="relative rounded-3xl p-8 border-2 border-white transform md:scale-105 h-full flex flex-col bg-[#0A0A0A] text-white">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white text-black px-4 py-1 rounded-full text-sm font-bold">
                  {t('marketingLanding.pricing.popular')}
                </div>
                <div className="text-sm font-semibold text-[#A0A0A0] mb-2">{t('marketingLanding.pricing.pro.name')}</div>
                <div className="mb-6">
                  <div className="text-5xl font-bold text-white mb-2">
                    {t('marketingLanding.pricing.pro.price')}
                    <span className="text-lg text-[#A0A0A0] font-normal">{t('marketingLanding.pricing.perMonth')}</span>
                  </div>
                  <p className="text-[#A0A0A0]">{t('marketingLanding.pricing.pro.description')}</p>
                </div>
                <div className="mb-6 py-3 px-4 bg-[#0A0A0A]/10 rounded-xl backdrop-blur-sm border border-white/20">
                  <p className="text-sm text-white font-semibold">{t('marketingLanding.pricing.pro.fee')} {t('marketingLanding.pricing.feeOnSale')}</p>
                </div>
                <ul className="space-y-4 mb-8 flex-grow">
                  {(t('marketingLanding.pricing.pro.features', { returnObjects: true }) as string[]).map((feature: string) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="text-[#22C55E] flex-shrink-0 mt-0.5" size={20} />
                      <span className="text-white">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleGetStarted}
                  className="shimmer-btn w-full bg-[#0A0A0A] hover:bg-[#E0E0E0] text-[#FAFAFA] py-3 rounded-xl font-semibold transition-all duration-300 hover:"
                >
                  {t('marketingLanding.pricing.choosePro')}
                </button>
              </div>
            </FadeInSection>

            {/* Scale */}
            <FadeInSection delay={400}>
              <div className="glass-card rounded-3xl p-8 border border-[#1F1F1F] hover:border-[#333333] transition-all duration-300 hover:-translate-y-2 hover: h-full flex flex-col">
                <div className="text-sm font-semibold text-[#FAFAFA] mb-2">{t('marketingLanding.pricing.scale.name')}</div>
                <div className="mb-6">
                  <div className="text-5xl font-bold text-[#FAFAFA] mb-2">
                    {t('marketingLanding.pricing.scale.price')}
                    <span className="text-lg text-[#666666] font-normal">{t('marketingLanding.pricing.perMonth')}</span>
                  </div>
                  <p className="text-[#A0A0A0]">{t('marketingLanding.pricing.scale.description')}</p>
                </div>
                <div className="mb-6 py-3 px-4 bg-[#1F1F1F] rounded-xl border border-[#1F1F1F]">
                  <p className="text-sm text-[#22C55E] font-semibold">{t('marketingLanding.pricing.scale.fee')} {t('marketingLanding.pricing.feeOnSale')}</p>
                </div>
                <ul className="space-y-4 mb-8 flex-grow">
                  {(t('marketingLanding.pricing.scale.features', { returnObjects: true }) as string[]).map((feature: string) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="text-[#22C55E] flex-shrink-0 mt-0.5" size={20} />
                      <span className="text-[#A0A0A0]">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleGetStarted}
                  className="w-full bg-[#0A0A0A] hover:bg-[#1F1F1F] text-white py-3 rounded-xl font-semibold transition-all duration-300 hover:"
                >
                  {t('marketingLanding.pricing.chooseScale')}
                </button>
              </div>
            </FadeInSection>
          </div>

          {/* Activation Fee Note */}
          <FadeInSection delay={500}>
            <p className="text-center text-[#666666] text-sm mb-8">
              {t('marketingLanding.pricing.activationNote')}
            </p>
          </FadeInSection>

          {/* Guarantee */}
          <FadeInSection delay={600}>
            <div className="bg-[#0A0A0A] rounded-3xl p-8 max-w-3xl mx-auto border border-[#1F1F1F]">
              <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                <div className="w-20 h-20 bg-[#1F1F1F] rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Shield className="text-white" size={40} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-[#FAFAFA] mb-2">{t('marketingLanding.pricing.guarantee.title')}</h3>
                  <p className="text-[#A0A0A0] text-lg">
                    {t('marketingLanding.pricing.guarantee.description')}
                  </p>
                </div>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ========================================================================
          FINAL CTA
      ======================================================================== */}
      <section className="py-24 px-4 bg-[#0A0A0A] border-t border-[#1F1F1F] text-white relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/5 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <FadeInSection>
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              {t('marketingLanding.cta.titlePrefix')}{' '}
              <span className="text-gradient">{t('marketingLanding.cta.titleHighlight')}</span>{' '}
              {t('marketingLanding.cta.titleSuffix')}
            </h2>
          </FadeInSection>
          <FadeInSection delay={100}>
            <p className="text-xl text-[#A0A0A0] mb-10 max-w-2xl mx-auto">
              {t('marketingLanding.cta.subtitle')}
            </p>
          </FadeInSection>
          <FadeInSection delay={200}>
            <button
              onClick={handleGetStarted}
              className="group shimmer-btn bg-[#0A0A0A] hover:bg-[#E0E0E0] text-[#FAFAFA] px-10 py-5 rounded-2xl font-bold text-xl transition-all duration-300   hover: hover:-translate-y-1 inline-flex items-center gap-3"
            >
              {t('marketingLanding.cta.startNow')}
              <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </FadeInSection>
          <FadeInSection delay={300}>
            <p className="text-[#A0A0A0] mt-8 flex flex-wrap justify-center gap-4">
              <span className="flex items-center gap-2">
                <Check size={16} className="text-[#22C55E]" />
                {t('marketingLanding.cta.benefits.activation')}
              </span>
              <span className="flex items-center gap-2">
                <Check size={16} className="text-[#22C55E]" />
                {t('marketingLanding.cta.benefits.noMonthlyFee')}
              </span>
              <span className="flex items-center gap-2">
                <Check size={16} className="text-[#22C55E]" />
                {t('marketingLanding.cta.benefits.cancelAnytime')}
              </span>
            </p>
          </FadeInSection>
        </div>
      </section>

      {/* ========================================================================
          FOOTER
      ======================================================================== */}
      <footer className="bg-[#0A0A0A] text-white py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="mb-4">
                <Logo variant="light" size="sm" showText={false} />
              </div>
              <p className="text-[#A0A0A0] mb-4">
                {t('marketingLanding.footer.tagline')}
              </p>
              <div className="flex gap-3">
                {[Twitter, Linkedin, Github].map((Icon, i) => (
                  <a
                    key={i}
                    href="#"
                    className="w-10 h-10 bg-[#1F1F1F] hover:bg-[#333333] rounded-xl flex items-center justify-center transition-all duration-300 hover:-translate-y-1"
                  >
                    <Icon size={18} />
                  </a>
                ))}
              </div>
            </div>

            {[
              { title: t('marketingLanding.footer.product'), links: [t('marketingLanding.footer.features'), t('marketingLanding.footer.pricing'), t('marketingLanding.footer.roadmap'), 'Changelog'] },
              { title: t('marketingLanding.footer.resources'), links: [t('marketingLanding.footer.documentation'), t('marketingLanding.footer.helpCenter'), t('marketingLanding.footer.blog'), t('nav.community')] },
              { title: t('marketingLanding.footer.company'), links: [t('marketingLanding.footer.about'), t('marketingLanding.footer.privacy'), t('marketingLanding.footer.terms'), t('nav.contact')] },
            ].map(section => (
              <div key={section.title}>
                <h3 className="font-bold mb-4 text-white">{section.title}</h3>
                <ul className="space-y-3">
                  {section.links.map(link => (
                    <li key={link}>
                      <a href="#" className="text-[#A0A0A0] hover:text-white transition-colors">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-[#1F1F1F] pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[#A0A0A0] text-sm">
              {t('marketingLanding.footer.copyright')}
            </p>
            <div className="flex items-center gap-2 text-sm text-[#666666]">
              <Globe size={16} />
              <span>{t('marketingLanding.footer.madeIn')} ❤️ {t('marketingLanding.footer.inBulgaria')}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MarketingLandingPage;
