import { useTranslation } from 'react-i18next';
import { totalUsers, totalCountries, totalCities, uptimePercent, planBreakdown } from '../../../data/tracking-locations';
import AnimatedCounter from './AnimatedCounter';

const StatsBar: React.FC = () => {
  const { t } = useTranslation();
  const plans = planBreakdown(totalUsers);

  const mainStats = [
    { label: t('tracking.activeUsers'), value: totalUsers },
    { label: t('tracking.countries'), value: totalCountries },
    { label: t('tracking.cities'), value: totalCities },
    { label: t('tracking.uptime'), value: uptimePercent, suffix: '%', decimals: 2 },
  ];

  const planStats = [
    { label: t('tracking.free'), value: plans.free },
    { label: t('tracking.pro'), value: plans.pro },
    { label: t('tracking.exclusive'), value: plans.exclusive },
  ];

  return (
    <div className="space-y-4">
      {/* Main metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {mainStats.map((stat) => (
          <div
            key={stat.label}
            className="bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-xl p-4 text-center hover:border-[#333333] transition-colors duration-150"
          >
            <div className="text-3xl md:text-4xl font-bold text-[var(--fc-section-text,#FAFAFA)] mb-1">
              <AnimatedCounter value={stat.value} suffix={stat.suffix} decimals={stat.decimals} />
            </div>
            <div className="text-sm text-[var(--fc-section-muted,#A0A0A0)]">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Plan distribution */}
      <div className="grid grid-cols-3 gap-4">
        {planStats.map((stat) => (
          <div
            key={stat.label}
            className="bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-xl p-4 text-center hover:border-[#333333] transition-colors duration-150"
          >
            <div className="text-2xl font-bold text-[var(--fc-section-text,#FAFAFA)] mb-1">
              <AnimatedCounter value={stat.value} />
            </div>
            <div className="text-sm text-[var(--fc-section-muted,#A0A0A0)]">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatsBar;
