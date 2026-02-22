import React from 'react';
import { MessageSquare, BookOpen, Calendar, Brain } from 'lucide-react';

interface SolutionCard {
  icon: React.ReactNode;
  title: string;
  description: string;
  features: string[];
}

const solutions: SolutionCard[] = [
  {
    icon: <MessageSquare className="w-8 h-8" />,
    title: 'Community Hub',
    description: 'Replace Discord with a branded community space',
    features: [
      'Channels & forums',
      'Direct messaging',
      'Member profiles',
      'Real-time chat',
    ],
  },
  {
    icon: <BookOpen className="w-8 h-8" />,
    title: 'Course LMS',
    description: 'Deliver courses better than Kajabi or Teachable',
    features: [
      'Unlimited courses',
      'Progress tracking',
      'Drip content',
      'Quizzes & assignments',
    ],
  },
  {
    icon: <Calendar className="w-8 h-8" />,
    title: 'Events & Scheduling',
    description: 'Replace Calendly with integrated booking',
    features: [
      'Group events',
      '1:1 coaching calls',
      'Automated reminders',
      'Timezone handling',
    ],
  },
  {
    icon: <Brain className="w-8 h-8" />,
    title: 'AI Success Manager',
    description: 'Your 24/7 assistant that tracks every student',
    features: [
      'Risk scoring',
      'Proactive outreach',
      'Progress insights',
      'Auto-answered FAQs',
    ],
  },
];

export const PromiseSection: React.FC = () => {
  return (
    <section className="py-20 px-4 bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Everything You Need, Unified
          </h2>
          <p className="text-xl text-indigo-100 max-w-2xl mx-auto">
            Stop paying for 5 separate tools. Get all the features you need in one platform.
          </p>
        </div>

        {/* Solution Cards Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {solutions.map((solution, index) => (
            <div
              key={index}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-200 hover:scale-105"
            >
              {/* Icon */}
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                {solution.icon}
              </div>

              {/* Title */}
              <h3 className="text-2xl font-bold mb-2">
                {solution.title}
              </h3>

              {/* Description */}
              <p className="text-indigo-100 mb-4">
                {solution.description}
              </p>

              {/* Features List */}
              <ul className="space-y-2">
                {solution.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-center gap-2 text-sm text-indigo-50">
                    <svg
                      className="w-5 h-5 text-green-300 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <p className="text-lg text-indigo-100 mb-6">
            Plus payments, analytics, mobile apps, and more—all included
          </p>
          <button className="bg-white text-indigo-600 hover:bg-indigo-50 px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 shadow-xl hover:shadow-2xl hover:scale-105">
            See All Features
          </button>
        </div>
      </div>
    </section>
  );
};
