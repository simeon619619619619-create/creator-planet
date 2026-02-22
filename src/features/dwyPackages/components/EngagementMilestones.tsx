// =============================================================================
// EngagementMilestones Component
// Shows milestone/deliverable progress for an engagement
// =============================================================================

import { useTranslation } from 'react-i18next';
import type { DwyEngagementMilestone } from '../dwyTypes';

interface EngagementMilestonesProps {
  milestones: DwyEngagementMilestone[];
}

const statusColors = {
  pending: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
};

export function EngagementMilestones({ milestones }: EngagementMilestonesProps) {
  const { t } = useTranslation();
  const completedCount = milestones.filter(m => m.status === 'completed').length;
  const progressPercent = milestones.length > 0 ? (completedCount / milestones.length) * 100 : 0;

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusLabel = (status: 'pending' | 'in_progress' | 'completed') => {
    if (status === 'pending') return t('dwyPackages.engagementMilestones.statusPending');
    if (status === 'in_progress') return t('dwyPackages.engagementMilestones.statusInProgress');
    return t('dwyPackages.engagementMilestones.statusCompleted');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-900">{t('dwyPackages.engagementMilestones.title')}</h4>
        <span className="text-sm text-gray-500">
          {t('dwyPackages.engagementMilestones.completedOf', { completed: completedCount, total: milestones.length })}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-purple-600 rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Milestones list */}
      <div className="space-y-3">
        {milestones.map((milestone, index) => {
          const colorClass = statusColors[milestone.status];

          return (
            <div
              key={index}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                milestone.status === 'in_progress' ? 'bg-blue-50' : 'bg-gray-50'
              }`}
            >
              {/* Status icon */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${colorClass}`}>
                {milestone.status === 'completed' ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : milestone.status === 'in_progress' ? (
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                )}
              </div>

              {/* Milestone info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">{milestone.name}</div>
                <div className="text-xs text-gray-500">
                  {milestone.status === 'completed' && milestone.completed_at && (
                    <>{t('dwyPackages.engagementMilestones.completedOn', { date: formatDate(milestone.completed_at) })}</>
                  )}
                  {milestone.status === 'in_progress' && t('dwyPackages.engagementMilestones.inProgress')}
                  {milestone.status === 'pending' && milestone.due_at && (
                    <>{t('dwyPackages.engagementMilestones.due', { date: formatDate(milestone.due_at) })}</>
                  )}
                  {milestone.status === 'pending' && !milestone.due_at && t('dwyPackages.engagementMilestones.upcoming')}
                </div>
              </div>

              {/* Status badge */}
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
                {getStatusLabel(milestone.status)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default EngagementMilestones;
