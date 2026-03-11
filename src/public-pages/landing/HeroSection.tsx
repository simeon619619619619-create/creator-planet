import React from 'react';
import { ArrowRight, Play } from 'lucide-react';

interface HeroSectionProps {
  onGetStarted: () => void;
  onWatchDemo?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onGetStarted, onWatchDemo }) => {
  return (
    <section className="pt-32 pb-20 px-4 bg-[#0A0A0A]">
      <div className="max-w-6xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-[#1F1F1F] px-4 py-2 rounded-full border border-[#333333] mb-8">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
          <span className="text-sm font-medium text-[#A0A0A0]">
            The All-in-One Platform for Course Creators
          </span>
        </div>

        {/* Main Headline */}
        <h1 className="text-5xl md:text-7xl font-bold text-[#FAFAFA] mb-6 leading-tight tracking-tight">
          Replace 5+ Tools with{' '}
          <span className="heading-highlight">
            One Powerful Platform
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-xl md:text-2xl text-[#A0A0A0] mb-12 max-w-3xl mx-auto leading-relaxed">
          Stop juggling Discord, Kajabi, Calendly, Skool, and Zapier.
          Manage your community, courses, events, and student success—all in one place.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <button
            onClick={onGetStarted}
            className="cta-primary bg-white hover:bg-[#E0E0E0] text-black px-8 py-4 rounded-xl font-semibold text-lg flex items-center gap-2"
          >
            Start Free Trial
            <ArrowRight className="w-5 h-5" />
          </button>

          {onWatchDemo && (
            <button
              onClick={onWatchDemo}
              className="cta-secondary bg-transparent hover:bg-[#151515] text-[#FAFAFA] px-8 py-4 rounded-xl font-semibold text-lg border border-[#1F1F1F] hover:border-[#333333] flex items-center gap-2"
            >
              <Play className="w-5 h-5" />
              Watch Demo
            </button>
          )}
        </div>

        {/* Trust Indicators */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-[#A0A0A0]">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#22C55E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#22C55E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>14-day free trial</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#22C55E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Cancel anytime</span>
          </div>
        </div>
      </div>
    </section>
  );
};
