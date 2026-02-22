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
    { name: 'Telegram', color: 'from-blue-400 to-blue-600', icon: '✈️' },
    { name: 'Viber', color: 'from-purple-400 to-purple-600', icon: '📱' },
    { name: 'Skool', color: 'from-yellow-400 to-yellow-600', icon: '🎓' },
    { name: 'Discord', color: 'from-indigo-400 to-indigo-600', icon: '💬' },
    { name: 'Kajabi', color: 'from-pink-400 to-pink-600', icon: '📚' },
    { name: 'Calendly', color: 'from-blue-500 to-blue-700', icon: '📅' },
    { name: 'Zapier', color: 'from-orange-400 to-orange-600', icon: '⚡' },
    { name: 'Whop', color: 'from-slate-500 to-slate-700', icon: '🛒' },
  ];

  // Five pillars with enhanced data - use translation keys
  const pillars = [
    {
      icon: MessageSquare,
      id: 'communityHub',
      color: 'from-indigo-500 to-blue-600',
    },
    {
      icon: BookOpen,
      id: 'courseLms',
      color: 'from-purple-500 to-pink-600',
    },
    {
      icon: Calendar,
      id: 'eventsBooking',
      color: 'from-pink-500 to-rose-600',
    },
    {
      icon: Brain,
      id: 'aiSuccessManager',
      color: 'from-emerald-500 to-teal-600',
    },
    {
      icon: BarChart3,
      id: 'analytics',
      color: 'from-orange-500 to-amber-600',
    },
  ];

  // Testimonials - use translation keys
  const testimonialIds = ['maria', 'georgi', 'elena'];
  const testimonialGradients = [
    'from-pink-400 to-rose-500',
    'from-blue-400 to-indigo-500',
    'from-purple-400 to-violet-500',
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
    <div className="min-h-screen bg-white overflow-hidden">
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
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.4); }
          50% { box-shadow: 0 0 40px rgba(99, 102, 241, 0.8); }
        }
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 8s ease-in-out infinite; }
        .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient-shift 3s ease infinite;
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.3);
        }
        .glass-dark {
          background: rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .mesh-gradient {
          background:
            radial-gradient(at 40% 20%, hsla(228, 100%, 74%, 0.3) 0px, transparent 50%),
            radial-gradient(at 80% 0%, hsla(270, 100%, 74%, 0.3) 0px, transparent 50%),
            radial-gradient(at 0% 50%, hsla(343, 100%, 76%, 0.2) 0px, transparent 50%),
            radial-gradient(at 80% 50%, hsla(225, 100%, 74%, 0.2) 0px, transparent 50%),
            radial-gradient(at 0% 100%, hsla(270, 100%, 74%, 0.3) 0px, transparent 50%);
        }
        .text-gradient {
          background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
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
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          animation: shimmer 2s infinite;
        }
      `}</style>

      {/* Navigation - Glassmorphism */}
      <nav className="fixed top-0 w-full glass-card z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Logo variant="dark" size="sm" showText={false} />
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#pillars" className="text-slate-600 hover:text-indigo-600 transition-colors font-medium">{t('marketingLanding.nav.pillars')}</a>
              <a href="#pricing" className="text-slate-600 hover:text-indigo-600 transition-colors font-medium">{t('marketingLanding.nav.pricing')}</a>
              <a href="#testimonials" className="text-slate-600 hover:text-indigo-600 transition-colors font-medium">{t('marketingLanding.nav.testimonials')}</a>
              <LanguageSwitcher variant="minimal" />
              <button
                onClick={handleGetStarted}
                className="shimmer-btn bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-2 rounded-lg font-semibold transition-all duration-300 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-0.5"
              >
                {t('marketingLanding.nav.getStarted')}
              </button>
            </div>

            {/* Mobile Navigation Controls */}
            <div className="flex md:hidden items-center gap-3">
              <LanguageSwitcher variant="minimal" />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-slate-600 hover:text-slate-900 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-slate-200/50 py-4 bg-white/95 backdrop-blur-md">
              <div className="flex flex-col gap-4">
                <a
                  href="#pillars"
                  className="text-slate-600 hover:text-indigo-600 transition-colors px-2 py-2 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('marketingLanding.nav.pillars')}
                </a>
                <a
                  href="#pricing"
                  className="text-slate-600 hover:text-indigo-600 transition-colors px-2 py-2 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('marketingLanding.nav.pricing')}
                </a>
                <a
                  href="#testimonials"
                  className="text-slate-600 hover:text-indigo-600 transition-colors px-2 py-2 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('marketingLanding.nav.testimonials')}
                </a>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleGetStarted();
                  }}
                  className="shimmer-btn bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 text-center"
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
      <section className="relative pt-32 pb-20 px-4 mesh-gradient min-h-screen flex items-center">
        {/* Floating decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <FloatingElement delay={0} className="absolute top-20 left-10 w-20 h-20 bg-gradient-to-br from-indigo-400/30 to-purple-400/30 rounded-full blur-xl" />
          <FloatingElement delay={1000} className="absolute top-40 right-20 w-32 h-32 bg-gradient-to-br from-pink-400/30 to-rose-400/30 rounded-full blur-xl" />
          <FloatingElement delay={2000} className="absolute bottom-40 left-1/4 w-24 h-24 bg-gradient-to-br from-blue-400/30 to-cyan-400/30 rounded-full blur-xl" />
          <FloatingElement delay={500} className="absolute bottom-20 right-1/3 w-16 h-16 bg-gradient-to-br from-purple-400/30 to-pink-400/30 rounded-full blur-xl" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <FadeInSection delay={0}>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm text-indigo-700 px-5 py-2.5 rounded-full text-sm font-semibold mb-8 shadow-lg border border-indigo-100">
                <Sparkles size={16} className="text-indigo-500" />
                <span>{t('marketingLanding.heroBadge')}</span>
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
              </div>
            </FadeInSection>

            <FadeInSection delay={100}>
              {/* Headline */}
              <h1 className="text-5xl md:text-7xl font-bold text-slate-900 mb-6 leading-tight">
                {t('marketingLanding.heroTitle')}{' '}
                <span className="text-gradient animate-gradient">
                  {t('marketingLanding.heroTitleHighlight')}
                </span>
              </h1>
            </FadeInSection>

            <FadeInSection delay={200}>
              {/* Subheadline */}
              <p className="text-xl md:text-2xl text-slate-600 mb-10 leading-relaxed max-w-3xl mx-auto">
                {t('marketingLanding.heroSubtitle1')} <span className="font-semibold text-slate-800">{t('marketingLanding.heroSubtitle2')}</span> {t('marketingLanding.heroSubtitle3')}{' '}
                <span className="font-semibold text-indigo-600">{t('marketingLanding.heroSubtitle4')}</span>
                {t('marketingLanding.heroSubtitle5')}
              </p>
            </FadeInSection>

            <FadeInSection delay={300}>
              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <button
                  onClick={handleGetStarted}
                  className="group shimmer-btn bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/40 hover:-translate-y-1"
                >
                  {t('marketingLanding.startFree')}
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <button className="group bg-white hover:bg-slate-50 text-slate-900 px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 border-2 border-slate-200 hover:border-indigo-300 flex items-center justify-center gap-2 hover:-translate-y-1">
                  <Play size={20} className="text-indigo-600" />
                  {t('marketingLanding.watchDemo')}
                </button>
              </div>
            </FadeInSection>

            <FadeInSection delay={400}>
              {/* Trust Indicators */}
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-600">
                <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full">
                  <Check className="text-green-500" size={18} />
                  {t('marketingLanding.noCardRequired')}
                </div>
                <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full">
                  <Check className="text-green-500" size={18} />
                  {t('marketingLanding.readyInMinutes')}
                </div>
                <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full">
                  <Check className="text-green-500" size={18} />
                  {t('marketingLanding.cancelAnytime')}
                </div>
              </div>
            </FadeInSection>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-slate-300 rounded-full flex justify-center pt-2">
            <div className="w-1.5 h-3 bg-slate-400 rounded-full animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* ========================================================================
          SOCIAL PROOF - Animated Counters (only show if we have real data)
      ======================================================================== */}
      {hasRealStats && (
        <section className="py-16 px-4 bg-slate-900 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 to-purple-600/10"></div>
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.filter(stat => stat.value > 0).map((stat, index) => {
                const { count, ref } = useAnimatedCounter(stat.value);
                return (
                  <FadeInSection key={stat.label} delay={index * 100}>
                    <div className="text-center group">
                      <div className="w-14 h-14 mx-auto mb-4 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <stat.icon className="text-indigo-400" size={28} />
                      </div>
                      <div className="text-4xl md:text-5xl font-bold text-white mb-2">
                        <span ref={ref}>{count.toLocaleString()}</span>
                        <span className="text-indigo-400">{stat.suffix}</span>
                      </div>
                      <p className="text-slate-400 font-medium">{stat.label}</p>
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
      <section className="py-24 px-4 bg-white relative">
        <div className="max-w-7xl mx-auto">
          <FadeInSection>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-full text-sm font-semibold mb-6 border border-red-100">
                <AlertTriangle size={16} />
                {t('marketingLanding.platformChaos')}
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
                {t('marketingLanding.platformChaosTitle')}{' '}
                <span className="text-red-500">{t('marketingLanding.platformChaosNightmare')}</span>?
              </h2>
              <p className="text-xl text-slate-600 max-w-3xl mx-auto">
                {t('marketingLanding.platformChaosSubtitle')}
              </p>
            </div>
          </FadeInSection>

          {/* Chaos Tools Grid - Bento Style */}
          <FadeInSection delay={200}>
            <div className="glass-card rounded-3xl p-8 md:p-12 mb-12 border border-slate-200 shadow-xl">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                {chaosTools.map((tool, index) => (
                  <div
                    key={tool.name}
                    className="group bg-white rounded-2xl p-5 border-2 border-slate-100 hover:border-red-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg relative overflow-hidden"
                  >
                    <div className={`w-12 h-12 bg-gradient-to-br ${tool.color} rounded-xl mb-4 flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform`}>
                      {tool.icon}
                    </div>
                    <p className="font-bold text-slate-800">{tool.name}</p>
                    <p className="text-sm text-slate-500">~€15-50/мес</p>
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-0 group-hover:scale-100">
                      <X size={12} className="text-white" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Pain Points with icons */}
              <div className="grid md:grid-cols-3 gap-6">
                <div className="flex items-center gap-4 bg-red-50/50 rounded-xl p-4">
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Zap className="text-red-600" size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{t('marketingLanding.painPoints.hoursLost')}</p>
                    <p className="text-sm text-slate-600">{t('marketingLanding.painPoints.hoursLostDesc')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 bg-orange-50/50 rounded-xl p-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Users className="text-orange-600" size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{t('marketingLanding.painPoints.lostStudents')}</p>
                    <p className="text-sm text-slate-600">{t('marketingLanding.painPoints.lostStudentsDesc')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 bg-purple-50/50 rounded-xl p-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="text-purple-600" size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{t('marketingLanding.painPoints.monthlySpend')}</p>
                    <p className="text-sm text-slate-600">{t('marketingLanding.painPoints.monthlySpendDesc')}</p>
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
      <section id="pillars" className="py-24 px-4 bg-slate-50 relative overflow-hidden">
        <div className="absolute inset-0 mesh-gradient opacity-30"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <FadeInSection>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full text-sm font-semibold mb-6 border border-indigo-100">
                <Layers size={16} />
                {t('marketingLanding.fivePillars')}
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
                {t('marketingLanding.fivePillarsTitle')}
              </h2>
              <p className="text-xl text-slate-600 max-w-3xl mx-auto">
                {t('marketingLanding.fivePillarsSubtitle')}
              </p>
            </div>
          </FadeInSection>

          {/* Bento Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Large card - AI Success Manager */}
            <FadeInSection delay={0} className="md:col-span-2 md:row-span-2">
              <div className="h-full glass-card rounded-3xl p-8 border border-slate-200 shadow-xl hover:shadow-2xl transition-all duration-500 group overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 group-hover:from-emerald-500/10 group-hover:to-teal-500/10 transition-all duration-500"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-6">
                    <div className={`w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <Brain className="text-white" size={32} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">{t('marketingLanding.pillars.aiSuccessManager.title')}</h3>
                      <p className="text-emerald-600 font-medium">{t('marketingLanding.pillars.aiSuccessManager.subtitle')}</p>
                    </div>
                  </div>
                  <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                    {t('marketingLanding.pillars.aiSuccessManager.description')}
                  </p>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="bg-white/80 rounded-xl p-4 border border-slate-100">
                      <Target className="text-emerald-500 mb-2" size={24} />
                      <p className="font-bold text-slate-900">{t('marketingLanding.pillars.aiSuccessManager.riskScoring')}</p>
                      <p className="text-sm text-slate-500">{t('marketingLanding.pillars.aiSuccessManager.riskScoringDesc')}</p>
                    </div>
                    <div className="bg-white/80 rounded-xl p-4 border border-slate-100">
                      <Sparkles className="text-blue-500 mb-2" size={24} />
                      <p className="font-bold text-slate-900">{t('marketingLanding.pillars.aiSuccessManager.smartAlerts')}</p>
                      <p className="text-sm text-slate-500">{t('marketingLanding.pillars.aiSuccessManager.smartAlertsDesc')}</p>
                    </div>
                    <div className="bg-white/80 rounded-xl p-4 border border-slate-100">
                      <BarChart3 className="text-purple-500 mb-2" size={24} />
                      <p className="font-bold text-slate-900">{t('marketingLanding.pillars.aiSuccessManager.healthDashboard')}</p>
                      <p className="text-sm text-slate-500">{t('marketingLanding.pillars.aiSuccessManager.healthDashboardDesc')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </FadeInSection>

            {/* Other pillars */}
            {pillars.filter(p => p.id !== 'aiSuccessManager').map((pillar, index) => (
              <FadeInSection key={pillar.id} delay={(index + 1) * 100}>
                <div className="h-full glass-card rounded-3xl p-6 border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 group hover:-translate-y-1">
                  <div className={`w-14 h-14 bg-gradient-to-br ${pillar.color} rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <pillar.icon className="text-white" size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{t(`marketingLanding.pillars.${pillar.id}.title`)}</h3>
                  <p className="text-slate-600 mb-4">{t(`marketingLanding.pillars.${pillar.id}.description`)}</p>
                  <div className="flex flex-wrap gap-2">
                    {(t(`marketingLanding.pillars.${pillar.id}.features`, { returnObjects: true }) as string[]).map((feature: string) => (
                      <span key={feature} className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
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
              <div className="inline-flex items-center gap-3 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 px-6 py-3 rounded-xl border border-green-200 shadow-sm">
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
      <section className="py-24 px-4 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-float-slow"></div>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <FadeInSection>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-semibold mb-6 border border-white/20">
                <Brain size={16} />
                {t('marketingLanding.aiSection.badge')}
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                {t('marketingLanding.aiSection.title')}
              </h2>
              <p className="text-xl text-indigo-200 max-w-3xl mx-auto">
                {t('marketingLanding.aiSection.subtitle')}
              </p>
            </div>
          </FadeInSection>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <FadeInSection direction="left">
              <div className="space-y-6">
                {[
                  { icon: Target, id: 'riskScoring', color: 'from-green-400 to-emerald-500' },
                  { icon: Sparkles, id: 'smartRecommendations', color: 'from-blue-400 to-cyan-500' },
                  { icon: BarChart3, id: 'healthDashboard', color: 'from-purple-400 to-pink-500' },
                ].map((item) => (
                  <div key={item.id} className="glass-dark rounded-2xl p-6 hover:bg-white/10 transition-all duration-300 group">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                        <item.icon className="text-white" size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold mb-2">{t(`marketingLanding.aiSectionDetails.${item.id}.title`)}</h3>
                        <p className="text-indigo-200">{t(`marketingLanding.aiSectionDetails.${item.id}.description`)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </FadeInSection>

            <FadeInSection direction="right">
              <div className="glass-dark rounded-3xl p-8 border border-white/10">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                    <Layers size={16} />
                    {t('marketingLanding.aiSectionDetails.osTitle')}
                  </div>
                  <h3 className="text-2xl font-bold">{t('marketingLanding.aiSectionDetails.osSubtitle')}</h3>
                </div>

                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-xl p-5 border border-white/10 hover:border-white/20 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <GraduationCap size={24} className="text-yellow-400" />
                      <span className="font-bold text-lg">{t('marketingLanding.aiSectionDetails.forCreator.title')}</span>
                    </div>
                    <p className="text-indigo-200">
                      {t('marketingLanding.aiSectionDetails.forCreator.description')}
                    </p>
                  </div>

                  <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl p-5 border border-white/10 hover:border-white/20 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <Users size={24} className="text-green-400" />
                      <span className="font-bold text-lg">{t('marketingLanding.aiSectionDetails.forStudent.title')}</span>
                    </div>
                    <p className="text-indigo-200">
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
      <section id="testimonials" className="py-24 px-4 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <FadeInSection>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-600 px-4 py-2 rounded-full text-sm font-semibold mb-6 border border-purple-100">
                <Star size={16} />
                {t('marketingLanding.testimonials.badge')}
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
                {t('marketingLanding.testimonials.title')}
              </h2>
            </div>
          </FadeInSection>

          {/* Testimonial Carousel */}
          <FadeInSection delay={200}>
            <div className="relative max-w-4xl mx-auto">
              <div className="glass-card rounded-3xl p-8 md:p-12 border border-slate-200 shadow-xl">
                <Quote className="text-indigo-200 mb-6" size={48} />
                <p className="text-2xl text-slate-700 mb-8 leading-relaxed italic">
                  "{t(`marketingLanding.testimonials.items.${testimonialIds[currentTestimonial]}.quote`)}"
                </p>

                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 bg-gradient-to-br ${testimonialGradients[currentTestimonial]} rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
                    {testimonialAvatars[currentTestimonial]}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-lg">{t(`marketingLanding.testimonials.items.${testimonialIds[currentTestimonial]}.name`)}</p>
                    <p className="text-slate-500">{t(`marketingLanding.testimonials.items.${testimonialIds[currentTestimonial]}.role`)}</p>
                    <div className="flex gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <Star key={i} size={14} className="text-yellow-400 fill-yellow-400" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-center gap-4 mt-8">
                <button
                  onClick={() => setCurrentTestimonial(prev => prev === 0 ? testimonialIds.length - 1 : prev - 1)}
                  className="w-12 h-12 bg-slate-100 hover:bg-indigo-100 rounded-full flex items-center justify-center transition-colors group"
                >
                  <ChevronLeft size={24} className="text-slate-600 group-hover:text-indigo-600" />
                </button>
                <div className="flex items-center gap-2">
                  {testimonialIds.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentTestimonial(index)}
                      className={`w-3 h-3 rounded-full transition-all duration-300 ${
                        index === currentTestimonial
                          ? 'bg-indigo-600 w-8'
                          : 'bg-slate-300 hover:bg-slate-400'
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setCurrentTestimonial(prev => prev === testimonialIds.length - 1 ? 0 : prev + 1)}
                  className="w-12 h-12 bg-slate-100 hover:bg-indigo-100 rounded-full flex items-center justify-center transition-colors group"
                >
                  <ChevronRight size={24} className="text-slate-600 group-hover:text-indigo-600" />
                </button>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ========================================================================
          ORIGIN STORY
      ======================================================================== */}
      <section id="story" className="py-24 px-4 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <FadeInSection>
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-2 rounded-full text-sm font-semibold mb-6 border border-rose-100">
                <Heart size={16} />
                {t('marketingLanding.originStory.badge')}
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
                {t('marketingLanding.originStory.title')}
              </h2>
            </div>
          </FadeInSection>

          <FadeInSection delay={200}>
            <div className="glass-card rounded-3xl p-8 md:p-12 border border-slate-200 shadow-xl">
              <div className="prose prose-lg max-w-none text-slate-600">
                <p className="text-xl leading-relaxed mb-6">
                  {t('marketingLanding.originStory.paragraph1')}
                </p>
                <p className="text-xl leading-relaxed mb-6">
                  <span className="font-semibold text-slate-900">{t('marketingLanding.originStory.paragraph2prefix')}</span> {t('marketingLanding.originStory.paragraph2')}
                </p>
                <p className="text-xl leading-relaxed">
                  {t('marketingLanding.originStory.paragraph3prefix')} <span className="font-bold text-gradient">Creator Club™</span> {t('marketingLanding.originStory.paragraph3suffix')}
                </p>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-200 flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  CC
                </div>
                <div>
                  <p className="font-bold text-slate-900">{t('marketingLanding.originStory.teamName')}</p>
                  <p className="text-slate-500">{t('marketingLanding.originStory.teamDesc')}</p>
                </div>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ========================================================================
          PRICING - Glassmorphism cards
      ======================================================================== */}
      <section id="pricing" className="py-24 px-4 bg-white relative overflow-hidden">
        <div className="absolute inset-0 mesh-gradient opacity-20"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <FadeInSection>
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full text-sm font-semibold mb-6 border border-indigo-100">
                <Trophy size={16} />
                {t('marketingLanding.pricing.badge')}
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
                {t('marketingLanding.pricing.title')}
              </h2>
              <p className="text-xl text-slate-600 max-w-3xl mx-auto">
                {t('marketingLanding.pricing.subtitle')}
              </p>
            </div>
          </FadeInSection>

          {/* User Roles */}
          <FadeInSection delay={100}>
            <div className="glass-card rounded-2xl p-6 md:p-8 border border-slate-200 mb-12 max-w-4xl mx-auto shadow-lg">
              <h3 className="text-xl font-bold text-slate-900 mb-4 text-center">{t('marketingLanding.pricing.userRoles.title')}</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex items-start gap-4 bg-indigo-50/50 rounded-xl p-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <GraduationCap className="text-white" size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{t('marketingLanding.pricing.userRoles.creator.title')}</p>
                    <p className="text-sm text-slate-600">
                      {t('marketingLanding.pricing.userRoles.creator.description')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4 bg-green-50/50 rounded-xl p-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Users className="text-white" size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{t('marketingLanding.pricing.userRoles.student.title')}</p>
                    <p className="text-sm text-slate-600">
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
              <div className="glass-card rounded-3xl p-8 border border-slate-200 hover:border-indigo-300 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl h-full flex flex-col">
                <div className="text-sm font-semibold text-indigo-600 mb-2">{t('marketingLanding.pricing.starter.name')}</div>
                <div className="mb-6">
                  <div className="text-5xl font-bold text-slate-900 mb-2">
                    {t('marketingLanding.pricing.starter.price')}
                    <span className="text-lg text-slate-500 font-normal">{t('marketingLanding.pricing.perMonth')}</span>
                  </div>
                  <p className="text-slate-600">{t('marketingLanding.pricing.starter.description')}</p>
                </div>
                <div className="mb-6 py-3 px-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-100">
                  <p className="text-sm text-orange-700 font-semibold">{t('marketingLanding.pricing.starter.fee')} {t('marketingLanding.pricing.feeOnSale')}</p>
                </div>
                <ul className="space-y-4 mb-8 flex-grow">
                  {(t('marketingLanding.pricing.starter.features', { returnObjects: true }) as string[]).map((feature: string) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="text-green-500 flex-shrink-0 mt-0.5" size={20} />
                      <span className="text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleGetStarted}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-semibold transition-all duration-300 hover:shadow-lg"
                >
                  {t('marketingLanding.pricing.startFree')}
                </button>
              </div>
            </FadeInSection>

            {/* Pro - Featured */}
            <FadeInSection delay={300}>
              <div className="relative rounded-3xl p-8 border-2 border-indigo-500 transform md:scale-105 shadow-2xl h-full flex flex-col bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-orange-400 text-slate-900 px-4 py-1 rounded-full text-sm font-bold shadow-lg">
                  {t('marketingLanding.pricing.popular')}
                </div>
                <div className="text-sm font-semibold text-indigo-200 mb-2">{t('marketingLanding.pricing.pro.name')}</div>
                <div className="mb-6">
                  <div className="text-5xl font-bold text-white mb-2">
                    {t('marketingLanding.pricing.pro.price')}
                    <span className="text-lg text-indigo-200 font-normal">{t('marketingLanding.pricing.perMonth')}</span>
                  </div>
                  <p className="text-indigo-100">{t('marketingLanding.pricing.pro.description')}</p>
                </div>
                <div className="mb-6 py-3 px-4 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
                  <p className="text-sm text-white font-semibold">{t('marketingLanding.pricing.pro.fee')} {t('marketingLanding.pricing.feeOnSale')}</p>
                </div>
                <ul className="space-y-4 mb-8 flex-grow">
                  {(t('marketingLanding.pricing.pro.features', { returnObjects: true }) as string[]).map((feature: string) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="text-green-300 flex-shrink-0 mt-0.5" size={20} />
                      <span className="text-white">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleGetStarted}
                  className="shimmer-btn w-full bg-white hover:bg-slate-50 text-indigo-600 py-3 rounded-xl font-semibold transition-all duration-300 hover:shadow-lg"
                >
                  {t('marketingLanding.pricing.choosePro')}
                </button>
              </div>
            </FadeInSection>

            {/* Scale */}
            <FadeInSection delay={400}>
              <div className="glass-card rounded-3xl p-8 border border-slate-200 hover:border-indigo-300 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl h-full flex flex-col">
                <div className="text-sm font-semibold text-indigo-600 mb-2">{t('marketingLanding.pricing.scale.name')}</div>
                <div className="mb-6">
                  <div className="text-5xl font-bold text-slate-900 mb-2">
                    {t('marketingLanding.pricing.scale.price')}
                    <span className="text-lg text-slate-500 font-normal">{t('marketingLanding.pricing.perMonth')}</span>
                  </div>
                  <p className="text-slate-600">{t('marketingLanding.pricing.scale.description')}</p>
                </div>
                <div className="mb-6 py-3 px-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
                  <p className="text-sm text-green-700 font-semibold">{t('marketingLanding.pricing.scale.fee')} {t('marketingLanding.pricing.feeOnSale')}</p>
                </div>
                <ul className="space-y-4 mb-8 flex-grow">
                  {(t('marketingLanding.pricing.scale.features', { returnObjects: true }) as string[]).map((feature: string) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="text-green-500 flex-shrink-0 mt-0.5" size={20} />
                      <span className="text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleGetStarted}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-semibold transition-all duration-300 hover:shadow-lg"
                >
                  {t('marketingLanding.pricing.chooseScale')}
                </button>
              </div>
            </FadeInSection>
          </div>

          {/* Activation Fee Note */}
          <FadeInSection delay={500}>
            <p className="text-center text-slate-500 text-sm mb-8">
              {t('marketingLanding.pricing.activationNote')}
            </p>
          </FadeInSection>

          {/* Guarantee */}
          <FadeInSection delay={600}>
            <div className="bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 rounded-3xl p-8 max-w-3xl mx-auto border border-green-200 shadow-lg">
              <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Shield className="text-white" size={40} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">{t('marketingLanding.pricing.guarantee.title')}</h3>
                  <p className="text-slate-600 text-lg">
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
      <section className="py-24 px-4 bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/20 rounded-full blur-3xl"></div>
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
            <p className="text-xl text-indigo-200 mb-10 max-w-2xl mx-auto">
              {t('marketingLanding.cta.subtitle')}
            </p>
          </FadeInSection>
          <FadeInSection delay={200}>
            <button
              onClick={handleGetStarted}
              className="group shimmer-btn bg-white hover:bg-slate-50 text-indigo-600 px-10 py-5 rounded-2xl font-bold text-xl transition-all duration-300 shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-1 inline-flex items-center gap-3"
            >
              {t('marketingLanding.cta.startNow')}
              <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </FadeInSection>
          <FadeInSection delay={300}>
            <p className="text-indigo-300 mt-8 flex flex-wrap justify-center gap-4">
              <span className="flex items-center gap-2">
                <Check size={16} className="text-green-400" />
                {t('marketingLanding.cta.benefits.activation')}
              </span>
              <span className="flex items-center gap-2">
                <Check size={16} className="text-green-400" />
                {t('marketingLanding.cta.benefits.noMonthlyFee')}
              </span>
              <span className="flex items-center gap-2">
                <Check size={16} className="text-green-400" />
                {t('marketingLanding.cta.benefits.cancelAnytime')}
              </span>
            </p>
          </FadeInSection>
        </div>
      </section>

      {/* ========================================================================
          FOOTER
      ======================================================================== */}
      <footer className="bg-slate-900 text-white py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="mb-4">
                <Logo variant="light" size="sm" showText={false} />
              </div>
              <p className="text-slate-400 mb-4">
                {t('marketingLanding.footer.tagline')}
              </p>
              <div className="flex gap-3">
                {[Twitter, Linkedin, Github].map((Icon, i) => (
                  <a
                    key={i}
                    href="#"
                    className="w-10 h-10 bg-slate-800 hover:bg-indigo-600 rounded-xl flex items-center justify-center transition-all duration-300 hover:-translate-y-1"
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
                      <a href="#" className="text-slate-400 hover:text-white transition-colors">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-sm">
              {t('marketingLanding.footer.copyright')}
            </p>
            <div className="flex items-center gap-2 text-sm text-slate-500">
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
