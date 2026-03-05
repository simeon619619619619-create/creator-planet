// =============================================================================
// LoyaltyDashboard Component
// Shows points balance, milestone progress, and recent activity
// =============================================================================

import { useTranslation } from 'react-i18next';
import { useLoyaltyPoints } from '../hooks/useLoyaltyPoints';
import { MilestoneProgress } from './MilestoneProgress';
import { PointsHistory } from './PointsHistory';

interface LoyaltyDashboardProps {
  consecutiveMonths: number;
}

export function LoyaltyDashboard({ consecutiveMonths }: LoyaltyDashboardProps) {
  const { t } = useTranslation();
  const { balance, history, isLoading, error } = useLoyaltyPoints();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-[#1F1F1F] rounded-xl animate-pulse" />
        <div className="h-48 bg-[#1F1F1F] rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl p-4 text-[#EF4444]">
        {t('studentPlus.dashboard.loadError')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Points Balance Card */}
      <div className="bg-gradient-to-r to-[#1F1F1F] to-pink-600 text-white rounded-xl p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg opacity-90 mb-1">{t('studentPlus.dashboard.yourPoints')}</h2>
            <div className="text-4xl font-bold">
              {balance.total_points.toLocaleString()}
            </div>
          </div>
          <a
            href="/student-plus/rewards"
            className="bg-[#0A0A0A]/20 hover:bg-[#0A0A0A]/30 px-4 py-2 rounded-lg transition text-sm font-medium"
          >
            {t('studentPlus.dashboard.redeemRewards')}
          </a>
        </div>
        <div className="mt-6 flex gap-8 text-sm">
          <div>
            <span className="opacity-75">{t('studentPlus.dashboard.totalEarned')}</span>{' '}
            <span className="font-medium">{balance.total_earned.toLocaleString()}</span>
          </div>
          <div>
            <span className="opacity-75">{t('studentPlus.dashboard.totalSpent')}</span>{' '}
            <span className="font-medium">{balance.total_spent.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Milestone Progress */}
      <MilestoneProgress consecutiveMonths={consecutiveMonths} />

      {/* Recent Activity */}
      <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl p-6">
        <h3 className="font-semibold text-lg mb-4 text-[#FAFAFA]">{t('studentPlus.dashboard.recentActivity')}</h3>
        <PointsHistory transactions={history.slice(0, 5)} />
        {history.length === 0 && (
          <p className="text-[#666666] text-sm text-center py-4">
            {t('studentPlus.dashboard.noActivityYet')}
          </p>
        )}
      </div>
    </div>
  );
}

export default LoyaltyDashboard;
