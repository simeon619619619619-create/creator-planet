import React from 'react';
import { ArrowRight, Play } from 'lucide-react';

interface HeroSectionProps {
  onGetStarted: () => void;
  onWatchDemo?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onGetStarted, onWatchDemo }) => {
  return (
    <section className="pt-32 pb-20 px-4 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="max-w-6xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full border border-indigo-200 mb-8">
          <span className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></span>
          <span className="text-sm font-medium text-slate-700">
            The All-in-One Platform for Course Creators
          </span>
        </div>

        {/* Main Headline */}
        <h1 className="text-5xl md:text-7xl font-bold text-slate-900 mb-6 leading-tight">
          Replace 5+ Tools with{' '}
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            One Powerful Platform
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-xl md:text-2xl text-slate-600 mb-12 max-w-3xl mx-auto leading-relaxed">
          Stop juggling Discord, Kajabi, Calendly, Skool, and Zapier.
          Manage your community, courses, events, and student success—all in one place.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <button
            onClick={onGetStarted}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center gap-2 shadow-lg shadow-indigo-600/30 hover:shadow-xl hover:shadow-indigo-600/40 hover:scale-105"
          >
            Start Free Trial
            <ArrowRight className="w-5 h-5" />
          </button>

          {onWatchDemo && (
            <button
              onClick={onWatchDemo}
              className="bg-white hover:bg-slate-50 text-slate-700 px-8 py-4 rounded-xl font-semibold text-lg border-2 border-slate-200 transition-all duration-200 flex items-center gap-2 hover:border-slate-300"
            >
              <Play className="w-5 h-5" />
              Watch Demo
            </button>
          )}
        </div>

        {/* Trust Indicators */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>14-day free trial</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Cancel anytime</span>
          </div>
        </div>
      </div>
    </section>
  );
};
