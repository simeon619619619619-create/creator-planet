// =============================================================================
// MilestoneProgress Component
// Visual milestone tracker showing progress toward each tier
// =============================================================================

import { useTranslation } from 'react-i18next';
import { useMilestones } from '../hooks/useMilestones';

interface MilestoneProgressProps {
  consecutiveMonths: number;
}

export function MilestoneProgress({ consecutiveMonths }: MilestoneProgressProps) {
  const { t } = useTranslation();
  const { milestonesWithProgress, isLoading, getNextMilestone } = useMilestones(consecutiveMonths);
  const nextMilestone = getNextMilestone();

  if (isLoading) {
    return <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-lg text-gray-900">{t('studentPlus.milestones.title')}</h3>
        {nextMilestone && (
          <span className="text-sm text-gray-500">
            {nextMilestone.months_required - consecutiveMonths} {t('studentPlus.milestones.monthsTo')} {nextMilestone.name}
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="relative mb-8">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, (consecutiveMonths / 12) * 100)}%`,
            }}
          />
        </div>

        {/* Milestone Markers */}
        <div className="flex justify-between mt-4">
          {milestonesWithProgress.map((milestone) => (
            <div
              key={milestone.id}
              className={`flex flex-col items-center ${
                milestone.achieved ? 'text-purple-600' : 'text-gray-400'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                  milestone.achieved
                    ? 'bg-purple-100 ring-2 ring-purple-500'
                    : 'bg-gray-100'
                }`}
              >
                {milestone.badge_emoji}
              </div>
              <span className="text-xs mt-2 font-medium">{milestone.name}</span>
              <span className="text-xs opacity-75">{milestone.months_required}{t('studentPlus.milestones.mo')}</span>
              {milestone.achieved && (
                <span className="text-xs text-green-600 font-medium mt-1">{t('studentPlus.milestones.achieved')}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Current Status */}
      <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
        <div>
          <div className="text-sm text-purple-700 font-medium">{t('studentPlus.milestones.currentProgress')}</div>
          <div className="text-2xl font-bold text-purple-900">
            {consecutiveMonths} {consecutiveMonths === 1 ? t('studentPlus.milestones.month') : t('studentPlus.milestones.months')}
          </div>
        </div>
        {nextMilestone && (
          <div className="text-right">
            <div className="text-sm text-purple-700 font-medium">{t('studentPlus.milestones.nextReward')}</div>
            <div className="text-lg font-bold text-purple-900">
              +{nextMilestone.bonus_points} {t('studentPlus.milestones.points')}
            </div>
            <div className="text-xs text-purple-600">{nextMilestone.badge_emoji} {nextMilestone.name}</div>
          </div>
        )}
        {!nextMilestone && consecutiveMonths >= 12 && (
          <div className="text-right">
            <div className="text-sm text-purple-700 font-medium">{t('studentPlus.milestones.status')}</div>
            <div className="text-lg font-bold text-purple-900">{t('studentPlus.milestones.diamondMember')}</div>
            <div className="text-xs text-purple-600">{t('studentPlus.milestones.allMilestonesAchieved')}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MilestoneProgress;
