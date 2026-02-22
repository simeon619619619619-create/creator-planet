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
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Logo variant="dark" size="md" showText={false} />
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-slate-600 hover:text-slate-900 transition-colors">{t('nav.features')}</a>
              <a href="#pricing" className="text-slate-600 hover:text-slate-900 transition-colors">{t('nav.pricing')}</a>
              <a href="#testimonials" className="text-slate-600 hover:text-slate-900 transition-colors">{t('nav.testimonials')}</a>
              <LanguageSwitcher variant="minimal" />
              <Link
                to="/login"
                className="text-slate-600 hover:text-slate-900 transition-colors font-medium"
              >
                {t('auth.signIn')}
              </Link>
              <button
                onClick={onGetStarted}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
              >
                {t('common.getStarted')}
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
            <div className="md:hidden border-t border-slate-200 py-4 bg-white">
              <div className="flex flex-col gap-4">
                <a 
                  href="#features" 
                  className="text-slate-600 hover:text-slate-900 transition-colors px-2 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('nav.features')}
                </a>
                <a 
                  href="#pricing" 
                  className="text-slate-600 hover:text-slate-900 transition-colors px-2 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('nav.pricing')}
                </a>
                <a
                  href="#testimonials"
                  className="text-slate-600 hover:text-slate-900 transition-colors px-2 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('nav.testimonials')}
                </a>
                <Link
                  to="/login"
                  className="text-slate-700 hover:text-slate-900 transition-colors px-2 py-2 font-medium border border-slate-300 rounded-lg text-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('auth.signIn')}
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onGetStarted();
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors text-center"
                >
                  {t('common.getStarted')}
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full text-sm font-semibold mb-8">
              <Sparkles size={16} />
              {t('hero.badge')}
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-slate-900 mb-6 leading-tight">
              {t('hero.title')}{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {t('hero.titleHighlight')}
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-600 mb-10 leading-relaxed">
              {t('hero.subtitle')}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <button
                onClick={onGetStarted}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30"
              >
                {t('common.startFreeTrial')}
                <ArrowRight size={20} />
              </button>
              <button className="bg-white hover:bg-slate-50 text-slate-900 px-8 py-4 rounded-xl font-semibold text-lg transition-colors border-2 border-slate-200">
                {t('common.watchDemo')}
              </button>
            </div>

            <div className="flex items-center justify-center gap-8 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Check className="text-green-500" size={20} />
                {t('hero.noCreditCard')}
              </div>
              <div className="flex items-center gap-2">
                <Check className="text-green-500" size={20} />
                {t('hero.freeTrial')}
              </div>
              <div className="flex items-center gap-2">
                <Check className="text-green-500" size={20} />
                {t('hero.cancelAnytime')}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              {t('painPoints.title')}
            </h2>
            <p className="text-xl text-slate-600">
              {t('painPoints.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-slate-50 rounded-2xl p-8 border-2 border-slate-200">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-6">
                <Zap className="text-red-600" size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-4">
                {t('painPoints.multipleTools.title')}
              </h3>
              <p className="text-slate-600 leading-relaxed">
                {t('painPoints.multipleTools.description')}
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-8 border-2 border-slate-200">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-6">
                <Users className="text-orange-600" size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-4">
                {t('painPoints.losingStudents.title')}
              </h3>
              <p className="text-slate-600 leading-relaxed">
                {t('painPoints.losingStudents.description')}
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-8 border-2 border-slate-200">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
                <Clock className="text-purple-600" size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-4">
                {t('painPoints.manualTracking.title')}
              </h3>
              <p className="text-slate-600 leading-relaxed">
                {t('painPoints.manualTracking.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              {t('solution.title')}
            </h2>
            <p className="text-xl text-indigo-100">
              {t('solution.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <MessageSquare className="mb-4" size={32} />
              <h3 className="text-xl font-bold mb-2">{t('solution.communityHub.title')}</h3>
              <p className="text-indigo-100">
                {t('solution.communityHub.description')}
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <BookOpen className="mb-4" size={32} />
              <h3 className="text-xl font-bold mb-2">{t('solution.courseLms.title')}</h3>
              <p className="text-indigo-100">
                {t('solution.courseLms.description')}
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <Calendar className="mb-4" size={32} />
              <h3 className="text-xl font-bold mb-2">{t('solution.events.title')}</h3>
              <p className="text-indigo-100">
                {t('solution.events.description')}
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <Brain className="mb-4" size={32} />
              <h3 className="text-xl font-bold mb-2">{t('solution.aiManager.title')}</h3>
              <p className="text-indigo-100">
                {t('solution.aiManager.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              {t('features.title')}
            </h2>
            <p className="text-xl text-slate-600">
              {t('features.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="flex gap-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Users size={24} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-2">{t('features.memberManagement.title')}</h3>
                <p className="text-slate-600">
                  {t('features.memberManagement.description')}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <BarChart3 size={24} className="text-purple-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-2">{t('features.analytics.title')}</h3>
                <p className="text-slate-600">
                  {t('features.analytics.description')}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <DollarSign size={24} className="text-pink-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-2">{t('features.payments.title')}</h3>
                <p className="text-slate-600">
                  {t('features.payments.description')}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Shield size={24} className="text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-2">{t('features.contentProtection.title')}</h3>
                <p className="text-slate-600">
                  {t('features.contentProtection.description')}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Rocket size={24} className="text-orange-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-2">{t('features.fastSetup.title')}</h3>
                <p className="text-slate-600">
                  {t('features.fastSetup.description')}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Brain size={24} className="text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-2">{t('features.aiInsights.title')}</h3>
                <p className="text-slate-600">
                  {t('features.aiInsights.description')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              {t('testimonials.title')}
            </h2>
            <p className="text-xl text-slate-600">
              {t('testimonials.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} size={20} className="text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-slate-700 mb-6 leading-relaxed">
                "{t('testimonials.testimonial1.quote')}"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  SM
                </div>
                <div>
                  <div className="font-bold text-slate-900">{t('testimonials.testimonial1.name')}</div>
                  <div className="text-sm text-slate-500">{t('testimonials.testimonial1.role')}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} size={20} className="text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-slate-700 mb-6 leading-relaxed">
                "{t('testimonials.testimonial2.quote')}"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                  JC
                </div>
                <div>
                  <div className="font-bold text-slate-900">{t('testimonials.testimonial2.name')}</div>
                  <div className="text-sm text-slate-500">{t('testimonials.testimonial2.role')}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} size={20} className="text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-slate-700 mb-6 leading-relaxed">
                "{t('testimonials.testimonial3.quote')}"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-red-500 rounded-full flex items-center justify-center text-white font-bold">
                  EP
                </div>
                <div>
                  <div className="font-bold text-slate-900">{t('testimonials.testimonial3.name')}</div>
                  <div className="text-sm text-slate-500">{t('testimonials.testimonial3.role')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              {t('pricing.title')}
            </h2>
            <p className="text-xl text-slate-600">
              {t('pricing.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Starter Plan */}
            <div className="bg-white rounded-2xl p-8 border-2 border-slate-200 hover:border-indigo-300 transition-colors">
              <div className="text-sm font-semibold text-indigo-600 mb-2">{t('pricing.starter.name')}</div>
              <div className="mb-4">
                <div className="text-4xl font-bold text-slate-900 mb-2">
                  {t('pricing.starter.price')}
                  <span className="text-lg text-slate-500 font-normal">{t('pricing.perMonth')}</span>
                </div>
                <p className="text-slate-600">{t('pricing.starter.description')}</p>
              </div>
              <div className="mb-6">
                <p className="text-sm text-orange-700 font-semibold">{t('pricing.starter.fee')} {t('pricing.feeOnSale')}</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="text-green-500 flex-shrink-0 mt-1" size={20} />
                  <span className="text-slate-700">{t('pricing.starter.features.students')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-green-500 flex-shrink-0 mt-1" size={20} />
                  <span className="text-slate-700">{t('pricing.starter.features.courses')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-green-500 flex-shrink-0 mt-1" size={20} />
                  <span className="text-slate-700">{t('pricing.starter.features.community')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-green-500 flex-shrink-0 mt-1" size={20} />
                  <span className="text-slate-700">{t('pricing.starter.features.aiManager')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-green-500 flex-shrink-0 mt-1" size={20} />
                  <span className="text-slate-700">{t('pricing.starter.features.payments')}</span>
                </li>
              </ul>
              <button
                onClick={onGetStarted}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                {t('pricing.startFree')}
              </button>
            </div>

            {/* Pro Plan - Featured */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-8 border-2 border-indigo-500 relative transform md:scale-105 shadow-xl">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-slate-900 px-4 py-1 rounded-full text-sm font-bold">
                {t('pricing.mostPopular')}
              </div>
              <div className="text-sm font-semibold text-white mb-2">{t('pricing.pro.name')}</div>
              <div className="mb-4">
                <div className="text-4xl font-bold text-white mb-2">
                  {t('pricing.pro.price')}
                  <span className="text-lg text-indigo-200 font-normal">{t('pricing.perMonth')}</span>
                </div>
                <p className="text-indigo-100">{t('pricing.pro.description')}</p>
              </div>
              <div className="mb-6">
                <p className="text-sm text-white font-semibold">{t('pricing.pro.fee')} {t('pricing.feeOnSale')}</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="text-green-300 flex-shrink-0 mt-1" size={20} />
                  <span className="text-white">{t('pricing.pro.features.students')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-green-300 flex-shrink-0 mt-1" size={20} />
                  <span className="text-white">{t('pricing.pro.features.courses')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-green-300 flex-shrink-0 mt-1" size={20} />
                  <span className="text-white">{t('pricing.pro.features.communities')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-green-300 flex-shrink-0 mt-1" size={20} />
                  <span className="text-white">{t('pricing.pro.features.branding')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-green-300 flex-shrink-0 mt-1" size={20} />
                  <span className="text-white">{t('pricing.pro.features.support')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-green-300 flex-shrink-0 mt-1" size={20} />
                  <span className="text-white">{t('pricing.pro.features.analytics')}</span>
                </li>
              </ul>
              <button
                onClick={onGetStarted}
                className="w-full bg-white hover:bg-slate-50 text-indigo-600 py-3 rounded-lg font-semibold transition-colors"
              >
                {t('pricing.choosePlan')}
              </button>
            </div>

            {/* Scale Plan */}
            <div className="bg-white rounded-2xl p-8 border-2 border-slate-200 hover:border-indigo-300 transition-colors">
              <div className="text-sm font-semibold text-indigo-600 mb-2">{t('pricing.scale.name')}</div>
              <div className="mb-4">
                <div className="text-4xl font-bold text-slate-900 mb-2">
                  {t('pricing.scale.price')}
                  <span className="text-lg text-slate-500 font-normal">{t('pricing.perMonth')}</span>
                </div>
                <p className="text-slate-600">{t('pricing.scale.description')}</p>
              </div>
              <div className="mb-6">
                <p className="text-sm text-green-700 font-semibold">{t('pricing.scale.fee')} {t('pricing.feeOnSale')}</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="text-green-500 flex-shrink-0 mt-1" size={20} />
                  <span className="text-slate-700">{t('pricing.scale.features.students')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-green-500 flex-shrink-0 mt-1" size={20} />
                  <span className="text-slate-700">{t('pricing.scale.features.courses')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-green-500 flex-shrink-0 mt-1" size={20} />
                  <span className="text-slate-700">{t('pricing.scale.features.communities')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-green-500 flex-shrink-0 mt-1" size={20} />
                  <span className="text-slate-700">{t('pricing.scale.features.whiteLabel')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-green-500 flex-shrink-0 mt-1" size={20} />
                  <span className="text-slate-700">{t('pricing.scale.features.api')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="text-green-500 flex-shrink-0 mt-1" size={20} />
                  <span className="text-slate-700">{t('pricing.scale.features.accountManager')}</span>
                </li>
              </ul>
              <button
                onClick={onGetStarted}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                {t('pricing.choosePlan')}
              </button>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-slate-600">
              {t('pricing.allPlansInclude')}
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            {t('cta.title')}
          </h2>
          <p className="text-xl text-indigo-100 mb-10">
            {t('cta.subtitle')}
          </p>
          <button
            onClick={onGetStarted}
            className="bg-white hover:bg-slate-50 text-indigo-600 px-10 py-4 rounded-xl font-semibold text-lg transition-colors shadow-lg inline-flex items-center gap-2"
          >
            {t('common.startFreeTrial')}
            <ArrowRight size={20} />
          </button>
          <p className="text-indigo-200 mt-6">
            {t('cta.trialInfo')}
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="mb-4">
                <Logo variant="light" size="md" showText={false} />
              </div>
              <p className="text-slate-400">
                {t('footer.tagline')}
              </p>
            </div>

            <div>
              <h3 className="font-bold mb-4">{t('footer.product')}</h3>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#features" className="hover:text-white transition-colors">{t('nav.features')}</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">{t('nav.pricing')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.roadmap')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.changelog')}</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold mb-4">{t('footer.resources')}</h3>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">{t('nav.documentation')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('nav.helpCenter')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('nav.blog')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('nav.community')}</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold mb-4">{t('footer.company')}</h3>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">{t('nav.about')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('nav.privacy')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('nav.terms')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('nav.contact')}</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-sm">
              {t('footer.copyright')}
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors">
                <Twitter size={20} />
              </a>
              <a href="#" className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors">
                <Linkedin size={20} />
              </a>
              <a href="#" className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors">
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
