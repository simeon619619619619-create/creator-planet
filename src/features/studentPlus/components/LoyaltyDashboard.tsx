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
        <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
        {t('studentPlus.dashboard.loadError')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Points Balance Card */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg opacity-90 mb-1">{t('studentPlus.dashboard.yourPoints')}</h2>
            <div className="text-4xl font-bold">
              {balance.total_points.toLocaleString()}
            </div>
          </div>
          <a
            href="/student-plus/rewards"
            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition text-sm font-medium"
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
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-lg mb-4 text-gray-900">{t('studentPlus.dashboard.recentActivity')}</h3>
        <PointsHistory transactions={history.slice(0, 5)} />
        {history.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-4">
            {t('studentPlus.dashboard.noActivityYet')}
          </p>
        )}
      </div>
    </div>
  );
}

export default LoyaltyDashboard;
