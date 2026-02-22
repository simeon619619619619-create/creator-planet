import React from 'react';
import { Zap, Users, Clock } from 'lucide-react';

interface PainCard {
  icon: React.ReactNode;
  title: string;
  description: string;
  iconBgColor: string;
  iconColor: string;
}

const painPoints: PainCard[] = [
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Juggling Multiple Tools',
    description: 'Managing separate platforms for community, courses, scheduling, and automation costs time and money. Each tool has its own learning curve, login, and subscription fee.',
    iconBgColor: 'bg-red-100',
    iconColor: 'text-red-600',
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: 'Losing Students to Silence',
    description: 'Students fall through the cracks when you can\'t track their progress. You don\'t know who\'s struggling until they\'ve already ghosted or asked for a refund.',
    iconBgColor: 'bg-orange-100',
    iconColor: 'text-orange-600',
  },
  {
    icon: <Clock className="w-6 h-6" />,
    title: 'Manual Tracking & Admin Work',
    description: 'Spending hours each week checking student progress, answering the same questions, and managing schedules manually takes you away from creating great content.',
    iconBgColor: 'bg-purple-100',
    iconColor: 'text-purple-600',
  },
];

export const PainSection: React.FC = () => {
  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Sound Familiar?
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Most course creators face the same challenges that drain time and revenue
          </p>
        </div>

        {/* Pain Point Cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {painPoints.map((pain, index) => (
            <div
              key={index}
              className="bg-slate-50 rounded-2xl p-8 border-2 border-slate-200 hover:border-slate-300 transition-all duration-200 hover:shadow-lg"
            >
              {/* Icon */}
              <div className={`w-12 h-12 ${pain.iconBgColor} rounded-xl flex items-center justify-center mb-6 ${pain.iconColor}`}>
                {pain.icon}
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                {pain.title}
              </h3>

              {/* Description */}
              <p className="text-slate-600 leading-relaxed">
                {pain.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
