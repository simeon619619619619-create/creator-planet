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
    return <div className="h-32 bg-[#1F1F1F] rounded-xl animate-pulse" />;
  }

  return (
    <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-lg text-[#FAFAFA]">{t('studentPlus.milestones.title')}</h3>
        {nextMilestone && (
          <span className="text-sm text-[#666666]">
            {nextMilestone.months_required - consecutiveMonths} {t('studentPlus.milestones.monthsTo')} {nextMilestone.name}
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="relative mb-8">
        <div className="h-2 bg-[#1F1F1F] rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
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
                milestone.achieved ? 'text-[#FAFAFA]' : 'text-[#666666]'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                  milestone.achieved
                    ? 'bg-[#1F1F1F] ring-2 ring-white/10'
                    : 'bg-[#1F1F1F]'
                }`}
              >
                {milestone.badge_emoji}
              </div>
              <span className="text-xs mt-2 font-medium">{milestone.name}</span>
              <span className="text-xs opacity-75">{milestone.months_required}{t('studentPlus.milestones.mo')}</span>
              {milestone.achieved && (
                <span className="text-xs text-[#22C55E] font-medium mt-1">{t('studentPlus.milestones.achieved')}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Current Status */}
      <div className="flex items-center justify-between p-4 bg-[#151515] rounded-lg">
        <div>
          <div className="text-sm text-[#A0A0A0] font-medium">{t('studentPlus.milestones.currentProgress')}</div>
          <div className="text-2xl font-bold text-[#FAFAFA]">
            {consecutiveMonths} {consecutiveMonths === 1 ? t('studentPlus.milestones.month') : t('studentPlus.milestones.months')}
          </div>
        </div>
        {nextMilestone && (
          <div className="text-right">
            <div className="text-sm text-[#A0A0A0] font-medium">{t('studentPlus.milestones.nextReward')}</div>
            <div className="text-lg font-bold text-[#FAFAFA]">
              +{nextMilestone.bonus_points} {t('studentPlus.milestones.points')}
            </div>
            <div className="text-xs text-[#FAFAFA]">{nextMilestone.badge_emoji} {nextMilestone.name}</div>
          </div>
        )}
        {!nextMilestone && consecutiveMonths >= 12 && (
          <div className="text-right">
            <div className="text-sm text-[#A0A0A0] font-medium">{t('studentPlus.milestones.status')}</div>
            <div className="text-lg font-bold text-[#FAFAFA]">{t('studentPlus.milestones.diamondMember')}</div>
            <div className="text-xs text-[#FAFAFA]">{t('studentPlus.milestones.allMilestonesAchieved')}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MilestoneProgress;
