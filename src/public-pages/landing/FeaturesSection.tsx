import React from 'react';
import { MessageSquare, BookOpen, Calendar, Brain, CreditCard, BarChart3 } from 'lucide-react';

interface Feature {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const FeaturesSection: React.FC = () => {
  const features: Feature[] = [
    {
      id: 1,
      title: "Community Forums",
      description: "Built-in community with channels, posts, and real-time chat",
      icon: <MessageSquare className="w-6 h-6 text-indigo-600" />
    },
    {
      id: 2,
      title: "Course Builder",
      description: "Create courses with modules, lessons, and progress tracking",
      icon: <BookOpen className="w-6 h-6 text-indigo-600" />
    },
    {
      id: 3,
      title: "Event Scheduling",
      description: "Group events and 1:1 booking integrated",
      icon: <Calendar className="w-6 h-6 text-indigo-600" />
    },
    {
      id: 4,
      title: "AI Success Manager",
      description: "Track student health and get risk alerts",
      icon: <Brain className="w-6 h-6 text-indigo-600" />
    },
    {
      id: 5,
      title: "Payments",
      description: "Stripe integration for subscriptions and one-time payments",
      icon: <CreditCard className="w-6 h-6 text-indigo-600" />
    },
    {
      id: 6,
      title: "Analytics",
      description: "See engagement, completion rates, and revenue",
      icon: <BarChart3 className="w-6 h-6 text-indigo-600" />
    }
  ];

  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Everything You Need in One Platform
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Replace Discord, Kajabi, Calendly, Skool, and Zapier with a single all-in-one solution
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div
              key={feature.id}
              className="bg-slate-50 rounded-2xl p-6 hover:border-indigo-300 transition-colors border border-slate-200"
            >
              {/* Icon Container */}
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
                {feature.icon}
              </div>

              {/* Feature Title */}
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                {feature.title}
              </h3>

              {/* Feature Description */}
              <p className="text-slate-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
