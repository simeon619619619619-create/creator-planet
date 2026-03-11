import React, { useState } from 'react';
import { Link } from 'react-router-dom';
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
  Clock,
  DollarSign,
  Star,
  Shield,
  Rocket,
  Github,
  Twitter,
  Linkedin,
  Sparkles,
  Menu,
  X
} from 'lucide-react';
import { Logo } from '../shared/Logo';
import LanguageSwitcher from '../shared/LanguageSwitcher';

interface LandingPageProps {
  onGetStarted: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-[#0A0A0A]/80 backdrop-blur-md border-b border-[#1F1F1F] z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Logo variant="light" size="md" showText={false} />

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-[#A0A0A0] hover:text-[#FAFAFA] transition-colors duration-150">{t('nav.features')}</a>
              <a href="#pricing" className="text-[#A0A0A0] hover:text-[#FAFAFA] transition-colors duration-150">{t('nav.pricing')}</a>
              <a href="#testimonials" className="text-[#A0A0A0] hover:text-[#FAFAFA] transition-colors duration-150">{t('nav.testimonials')}</a>
              <Link to="/analytics" className="inline-flex items-center gap-1.5 text-[#A0A0A0] hover:text-[#FAFAFA] transition-colors duration-150 font-medium">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#22C55E]" />
                </span>
                {t('nav.analytics')}
              </Link>
              <LanguageSwitcher variant="minimal" />
              <Link
                to="/login"
                className="text-[#A0A0A0] hover:text-[#FAFAFA] transition-colors duration-150 font-medium"
              >
                {t('auth.signIn')}
              </Link>
              <button
                onClick={onGetStarted}
                className="bg-white hover:bg-[#E0E0E0] text-black px-6 py-2 rounded-lg font-semibold transition-colors duration-150"
              >
                {t('common.getStarted')}
              </button>
            </div>

            {/* Mobile Navigation Controls */}
            <div className="flex md:hidden items-center gap-3">
              <LanguageSwitcher variant="minimal" />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-[#A0A0A0] hover:text-[#FAFAFA] transition-colors duration-150"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-[#1F1F1F] py-4 bg-[#0A0A0A]">
              <div className="flex flex-col gap-4">
                <a
                  href="#features"
                  className="text-[#A0A0A0] hover:text-[#FAFAFA] transition-colors duration-150 px-2 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('nav.features')}
                </a>
                <a
                  href="#pricing"
                  className="text-[#A0A0A0] hover:text-[#FAFAFA] transition-colors duration-150 px-2 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('nav.pricing')}
                </a>
                <a
                  href="#testimonials"
                  className="text-[#A0A0A0] hover:text-[#FAFAFA] transition-colors duration-150 px-2 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('nav.testimonials')}
                </a>
                <Link
                  to="/login"
                  className="text-[#FAFAFA] hover:text-white transition-colors duration-150 px-2 py-2 font-medium border border-[#1F1F1F] rounded-lg text-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('auth.signIn')}
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onGetStarted();
                  }}
                  className="bg-white hover:bg-[#E0E0E0] text-black px-6 py-3 rounded-lg font-semibold transition-colors duration-150 text-center"
                >
                  {t('common.getStarted')}
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-[#1F1F1F] text-[#A0A0A0] px-4 py-2 rounded-full text-sm font-semibold mb-8">
              <Sparkles size={16} />
              {t('hero.badge')}
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-[#FAFAFA] mb-6 leading-tight tracking-tight">
              {t('hero.title')}{' '}
              <span className="heading-highlight">
                {t('hero.titleHighlight')}
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-[#A0A0A0] mb-10 leading-relaxed">
              {t('hero.subtitle')}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <button
                onClick={onGetStarted}
                className="cta-primary bg-white hover:bg-[#E0E0E0] text-black px-8 py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2"
              >
                {t('common.startFreeTrial')}
                <ArrowRight size={20} />
              </button>
              <button className="cta-secondary bg-transparent hover:bg-[#151515] text-[#FAFAFA] px-8 py-4 rounded-xl font-semibold text-lg border border-[#1F1F1F] hover:border-[#333333]">
                {t('common.watchDemo')}
              </button>
            </div>

            <div className="flex items-center justify-center gap-8 text-sm text-[#A0A0A0]">
              <div className="flex items-center gap-2">
                <Check className="text-[#22C55E]" size={20} />
                {t('hero.noCreditCard')}
              </div>
              <div className="flex items-center gap-2">
                <Check className="text-[#22C55E]" size={20} />
                {t('hero.freeTrial')}
              </div>
              <div className="flex items-center gap-2">
                <Check className="text-[#22C55E]" size={20} />
                {t('hero.cancelAnytime')}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="py-20 px-4 bg-[#0A0A0A] border-t border-[#1F1F1F]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-[#FAFAFA] mb-4">
              {t('painPoints.title')}
            </h2>
            <p className="text-xl text-[#A0A0A0]">
              {t('painPoints.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-[#0A0A0A] rounded-2xl p-8 border border-[#1F1F1F] hover:border-[#333333] transition-colors duration-150">
              <div className="w-12 h-12 bg-[#1F1F1F] rounded-xl flex items-center justify-center mb-6">
                <Zap className="text-[#FAFAFA]" size={24} />
              </div>
              <h3 className="text-xl font-bold text-[#FAFAFA] mb-4">
                {t('painPoints.multipleTools.title')}
              </h3>
              <p className="text-[#A0A0A0] leading-relaxed">
                {t('painPoints.multipleTools.description')}
              </p>
            </div>

            <div className="bg-[#0A0A0A] rounded-2xl p-8 border border-[#1F1F1F] hover:border-[#333333] transition-colors duration-150">
              <div className="w-12 h-12 bg-[#1F1F1F] rounded-xl flex items-center justify-center mb-6">
                <Users className="text-[#FAFAFA]" size={24} />
              </div>
              <h3 className="text-xl font-bold text-[#FAFAFA] mb-4">
                {t('painPoints.losingStudents.title')}
              </h3>
              <p className="text-[#A0A0A0] leading-relaxed">
                {t('painPoints.losingStudents.description')}
              </p>
            </div>

            <div className="bg-[#0A0A0A] rounded-2xl p-8 border border-[#1F1F1F] hover:border-[#333333] transition-colors duration-150">
              <div className="w-12 h-12 bg-[#1F1F1F] rounded-xl flex items-center justify-center mb-6">
                <Clock className="text-[#FAFAFA]" size={24} />
              </div>
              <h3 className="text-xl font-bold text-[#FAFAFA] mb-4">
                {t('painPoints.manualTracking.title')}
              </h3>
              <p className="text-[#A0A0A0] leading-relaxed">
                {t('painPoints.manualTracking.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-20 px-4 bg-[#0A0A0A] border-t border-[#1F1F1F]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-[#FAFAFA] mb-4">
              {t('solution.title')}
            </h2>
            <p className="text-xl text-[#A0A0A0]">
              {t('solution.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-[#1F1F1F] hover:border-[#333333] transition-colors duration-150">
              <MessageSquare className="mb-4 text-[#FAFAFA]" size={32} />
              <h3 className="text-xl font-bold text-[#FAFAFA] mb-2">{t('solution.communityHub.title')}</h3>
              <p className="text-[#A0A0A0]">
                {t('solution.communityHub.description')}
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-[#1F1F1F] hover:border-[#333333] transition-colors duration-150">
              <BookOpen className="mb-4 text-[#FAFAFA]" size={32} />
              <h3 className="text-xl font-bold text-[#FAFAFA] mb-2">{t('solution.courseLms.title')}</h3>
              <p className="text-[#A0A0A0]">
                {t('solution.courseLms.description')}
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-[#1F1F1F] hover:border-[#333333] transition-colors duration-150">
              <Calendar className="mb-4 text-[#FAFAFA]" size={32} />
              <h3 className="text-xl font-bold text-[#FAFAFA] mb-2">{t('solution.events.title')}</h3>
              <p className="text-[#A0A0A0]">
                {t('solution.events.description')}
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-[#1F1F1F] hover:border-[#333333] transition-colors duration-150">
              <Brain className="mb-4 text-[#FAFAFA]" size={32} />
              <h3 className="text-xl font-bold text-[#FAFAFA] mb-2">{t('solution.aiManager.title')}</h3>
              <p className="text-[#A0A0A0]">
                {t('solution.aiManager.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-4 bg-[#0A0A0A] border-t border-[#1F1F1F]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-[#FAFAFA] mb-4">
              {t('features.title')}
            </h2>
            <p className="text-xl text-[#A0A0A0]">
              {t('features.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="flex gap-4">
              <div className="w-12 h-12 bg-[#1F1F1F] rounded-xl flex items-center justify-center flex-shrink-0">
                <Users size={24} className="text-[#FAFAFA]" />
              </div>
              <div>
                <h3 className="font-bold text-[#FAFAFA] mb-2">{t('features.memberManagement.title')}</h3>
                <p className="text-[#A0A0A0]">
                  {t('features.memberManagement.description')}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 bg-[#1F1F1F] rounded-xl flex items-center justify-center flex-shrink-0">
                <BarChart3 size={24} className="text-[#FAFAFA]" />
              </div>
              <div>
                <h3 className="font-bold text-[#FAFAFA] mb-2">{t('features.analytics.title')}</h3>
                <p className="text-[#A0A0A0]">
                  {t('features.analytics.description')}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 bg-[#1F1F1F] rounded-xl flex items-center justify-center flex-shrink-0">
                <DollarSign size={24} className="text-[#FAFAFA]" />
              </div>
              <div>
                <h3 className="font-bold text-[#FAFAFA] mb-2">{t('features.payments.title')}</h3>
                <p className="text-[#A0A0A0]">
                  {t('features.payments.description')}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 bg-[#1F1F1F] rounded-xl flex items-center justify-center flex-shrink-0">
                <Shield size={24} className="text-[#FAFAFA]" />
              </div>
              <div>
                <h3 className="font-bold text-[#FAFAFA] mb-2">{t('features.contentProtection.title')}</h3>
                <p className="text-[#A0A0A0]">
                  {t('features.contentProtection.description')}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 bg-[#1F1F1F] rounded-xl flex items-center justify-center flex-shrink-0">
                <Rocket size={24} className="text-[#FAFAFA]" />
              </div>
              <div>
                <h3 className="font-bold text-[#FAFAFA] mb-2">{t('features.fastSetup.title')}</h3>
                <p className="text-[#A0A0A0]">
                  {t('features.fastSetup.description')}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 bg-[#1F1F1F] rounded-xl flex items-center justify-center flex-shrink-0">
                <Brain size={24} className="text-[#FAFAFA]" />
              </div>
              <div>
                <h3 className="font-bold text-[#FAFAFA] mb-2">{t('features.aiInsights.title')}</h3>
                <p className="text-[#A0A0A0]">
                  {t('features.aiInsights.description')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4 bg-[#0A0A0A] border-t border-[#1F1F1F]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-[#FAFAFA] mb-4">
              {t('testimonials.title')}
            </h2>
            <p className="text-xl text-[#A0A0A0]">
              {t('testimonials.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-[#0A0A0A] rounded-2xl p-8 border border-[#1F1F1F]">
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} size={20} className="text-[#EAB308] fill-[#EAB308]" />
                ))}
              </div>
              <p className="text-[#A0A0A0] mb-6 leading-relaxed">
                "{t('testimonials.testimonial1.quote')}"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#1F1F1F] rounded-full flex items-center justify-center text-[#FAFAFA] font-bold">
                  SM
                </div>
                <div>
                  <div className="font-bold text-[#FAFAFA]">{t('testimonials.testimonial1.name')}</div>
                  <div className="text-sm text-[#666666]">{t('testimonials.testimonial1.role')}</div>
                </div>
              </div>
            </div>

            <div className="bg-[#0A0A0A] rounded-2xl p-8 border border-[#1F1F1F]">
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} size={20} className="text-[#EAB308] fill-[#EAB308]" />
                ))}
              </div>
              <p className="text-[#A0A0A0] mb-6 leading-relaxed">
                "{t('testimonials.testimonial2.quote')}"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#1F1F1F] rounded-full flex items-center justify-center text-[#FAFAFA] font-bold">
                  JC
                </div>
                <div>
                  <div className="font-bold text-[#FAFAFA]">{t('testimonials.testimonial2.name')}</div>
                  <div className="text-sm text-[#666666]">{t('testimonials.testimonial2.role')}</div>
                </div>
              </div>
            </div>

            <div className="bg-[#0A0A0A] rounded-2xl p-8 border border-[#1F1F1F]">
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} size={20} className="text-[#EAB308] fill-[#EAB308]" />
                ))}
              </div>
              <p className="text-[#A0A0A0] mb-6 leading-relaxed">
                "{t('testimonials.testimonial3.quote')}"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#1F1F1F] rounded-full flex items-center justify-center text-[#FAFAFA] font-bold">
                  EP
                </div>
                <div>
                  <div className="font-bold text-[#FAFAFA]">{t('testimonials.testimonial3.name')}</div>
                  <div className="text-sm text-[#666666]">{t('testimonials.testimonial3.role')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-[#0A0A0A] border-t border-[#1F1F1F]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-[#FAFAFA] mb-4">
              {t('pricing.title')}
            </h2>
            <p className="text-xl text-[#A0A0A0]">
              {t('pricing.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Starter Plan */}
            <div className="bg-[#0A0A0A] rounded-2xl p-8 border border-[#1F1F1F] hover:border-[#333333] transition-colors duration-150">
              <div className="text-sm font-semibold text-[#A0A0A0] mb-2">{t('pricing.starter.name')}</div>
              <div className="mb-4">
                <div className="text-4xl font-bold text-[#FAFAFA] mb-2">
                  {t('pricing.starter.price')}
                  <span className="text-lg text-[#666666] font-normal">{t('pricing.perMonth')}</span>
                </div>
                <p className="text-[#A0A0A0]">{t('pricing.starter.description')}</p>
              </div>
              <div className="mb-6">
                <p className="text-sm text-[#EAB308] font-semibold">{t('pricing.starter.fee')} {t('pricing.feeOnSale')}</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="text-[#22C55E] flex-shrink-0 mt-1" size={20} />
                  <span className="text-[#A0A0A0]">{t('pricing.starter.features.students')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-[#22C55E] flex-shrink-0 mt-1" size={20} />
                  <span className="text-[#A0A0A0]">{t('pricing.starter.features.courses')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-[#22C55E] flex-shrink-0 mt-1" size={20} />
                  <span className="text-[#A0A0A0]">{t('pricing.starter.features.community')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-[#22C55E] flex-shrink-0 mt-1" size={20} />
                  <span className="text-[#A0A0A0]">{t('pricing.starter.features.aiManager')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-[#22C55E] flex-shrink-0 mt-1" size={20} />
                  <span className="text-[#A0A0A0]">{t('pricing.starter.features.payments')}</span>
                </li>
              </ul>
              <button
                onClick={onGetStarted}
                className="w-full bg-white hover:bg-[#E0E0E0] text-black py-3 rounded-lg font-semibold transition-colors duration-150"
              >
                {t('pricing.startFree')}
              </button>
            </div>

            {/* Pro Plan - Featured */}
            <div className="bg-[#0A0A0A] rounded-2xl p-8 border-2 border-white relative transform md:scale-105">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white text-black px-4 py-1 rounded-full text-sm font-bold">
                {t('pricing.mostPopular')}
              </div>
              <div className="text-sm font-semibold text-[#FAFAFA] mb-2">{t('pricing.pro.name')}</div>
              <div className="mb-4">
                <div className="text-4xl font-bold text-[#FAFAFA] mb-2">
                  {t('pricing.pro.price')}
                  <span className="text-lg text-[#666666] font-normal">{t('pricing.perMonth')}</span>
                </div>
                <p className="text-[#A0A0A0]">{t('pricing.pro.description')}</p>
              </div>
              <div className="mb-6">
                <p className="text-sm text-[#FAFAFA] font-semibold">{t('pricing.pro.fee')} {t('pricing.feeOnSale')}</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="text-[#22C55E] flex-shrink-0 mt-1" size={20} />
                  <span className="text-[#A0A0A0]">{t('pricing.pro.features.students')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-[#22C55E] flex-shrink-0 mt-1" size={20} />
                  <span className="text-[#A0A0A0]">{t('pricing.pro.features.courses')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-[#22C55E] flex-shrink-0 mt-1" size={20} />
                  <span className="text-[#A0A0A0]">{t('pricing.pro.features.communities')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-[#22C55E] flex-shrink-0 mt-1" size={20} />
                  <span className="text-[#A0A0A0]">{t('pricing.pro.features.branding')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-[#22C55E] flex-shrink-0 mt-1" size={20} />
                  <span className="text-[#A0A0A0]">{t('pricing.pro.features.support')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-[#22C55E] flex-shrink-0 mt-1" size={20} />
                  <span className="text-[#A0A0A0]">{t('pricing.pro.features.analytics')}</span>
                </li>
              </ul>
              <button
                onClick={onGetStarted}
                className="w-full bg-white hover:bg-[#E0E0E0] text-black py-3 rounded-lg font-semibold transition-colors duration-150"
              >
                {t('pricing.choosePlan')}
              </button>
            </div>

            {/* Scale Plan */}
            <div className="bg-[#0A0A0A] rounded-2xl p-8 border border-[#1F1F1F] hover:border-[#333333] transition-colors duration-150">
              <div className="text-sm font-semibold text-[#A0A0A0] mb-2">{t('pricing.scale.name')}</div>
              <div className="mb-4">
                <div className="text-4xl font-bold text-[#FAFAFA] mb-2">
                  {t('pricing.scale.price')}
                  <span className="text-lg text-[#666666] font-normal">{t('pricing.perMonth')}</span>
                </div>
                <p className="text-[#A0A0A0]">{t('pricing.scale.description')}</p>
              </div>
              <div className="mb-6">
                <p className="text-sm text-[#22C55E] font-semibold">{t('pricing.scale.fee')} {t('pricing.feeOnSale')}</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="text-[#22C55E] flex-shrink-0 mt-1" size={20} />
                  <span className="text-[#A0A0A0]">{t('pricing.scale.features.students')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-[#22C55E] flex-shrink-0 mt-1" size={20} />
                  <span className="text-[#A0A0A0]">{t('pricing.scale.features.courses')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-[#22C55E] flex-shrink-0 mt-1" size={20} />
                  <span className="text-[#A0A0A0]">{t('pricing.scale.features.communities')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-[#22C55E] flex-shrink-0 mt-1" size={20} />
                  <span className="text-[#A0A0A0]">{t('pricing.scale.features.whiteLabel')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-[#22C55E] flex-shrink-0 mt-1" size={20} />
                  <span className="text-[#A0A0A0]">{t('pricing.scale.features.api')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-[#22C55E] flex-shrink-0 mt-1" size={20} />
                  <span className="text-[#A0A0A0]">{t('pricing.scale.features.accountManager')}</span>
                </li>
              </ul>
              <button
                onClick={onGetStarted}
                className="w-full bg-white hover:bg-[#E0E0E0] text-black py-3 rounded-lg font-semibold transition-colors duration-150"
              >
                {t('pricing.choosePlan')}
              </button>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-[#A0A0A0]">
              {t('pricing.allPlansInclude')}
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-4 bg-[#0A0A0A] border-t border-[#1F1F1F]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-[#FAFAFA] mb-6 tracking-tight">
            {t('cta.title')}
          </h2>
          <p className="text-xl text-[#A0A0A0] mb-10">
            {t('cta.subtitle')}
          </p>
          <button
            onClick={onGetStarted}
            className="cta-primary bg-white hover:bg-[#E0E0E0] text-black px-10 py-4 rounded-xl font-semibold text-lg inline-flex items-center gap-2"
          >
            {t('common.startFreeTrial')}
            <ArrowRight size={20} />
          </button>
          <p className="text-[#666666] mt-6">
            {t('cta.trialInfo')}
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0A0A0A] border-t border-[#1F1F1F] text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="mb-4">
                <Logo variant="light" size="md" showText={false} />
              </div>
              <p className="text-[#A0A0A0]">
                {t('footer.tagline')}
              </p>
            </div>

            <div>
              <h3 className="font-bold text-[#FAFAFA] mb-4">{t('footer.product')}</h3>
              <ul className="space-y-2 text-[#A0A0A0]">
                <li><a href="#features" className="hover:text-white transition-colors duration-150">{t('nav.features')}</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors duration-150">{t('nav.pricing')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-150">{t('footer.roadmap')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-150">{t('footer.changelog')}</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-[#FAFAFA] mb-4">{t('footer.resources')}</h3>
              <ul className="space-y-2 text-[#A0A0A0]">
                <li><a href="#" className="hover:text-white transition-colors duration-150">{t('nav.documentation')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-150">{t('nav.helpCenter')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-150">{t('nav.blog')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-150">{t('nav.community')}</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-[#FAFAFA] mb-4">{t('footer.company')}</h3>
              <ul className="space-y-2 text-[#A0A0A0]">
                <li><a href="#" className="hover:text-white transition-colors duration-150">{t('nav.about')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-150">{t('nav.privacy')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-150">{t('nav.terms')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-150">{t('nav.contact')}</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-[#1F1F1F] pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[#666666] text-sm">
              {t('footer.copyright')}
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 bg-[#1F1F1F] hover:bg-[#333333] rounded-lg flex items-center justify-center transition-colors duration-150">
                <Twitter size={20} />
              </a>
              <a href="#" className="w-10 h-10 bg-[#1F1F1F] hover:bg-[#333333] rounded-lg flex items-center justify-center transition-colors duration-150">
                <Linkedin size={20} />
              </a>
              <a href="#" className="w-10 h-10 bg-[#1F1F1F] hover:bg-[#333333] rounded-lg flex items-center justify-center transition-colors duration-150">
                <Github size={20} />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
