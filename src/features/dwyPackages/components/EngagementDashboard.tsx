// =============================================================================
// EngagementDashboard Component
// Shows active DWY engagement details and progress
// =============================================================================

import { useTranslation } from 'react-i18next';
import type { DwyEngagement } from '../dwyTypes';
import { ENGAGEMENT_STATUS_CONFIG } from '../dwyTypes';
import { EngagementMilestones } from './EngagementMilestones';

interface EngagementDashboardProps {
  engagement: DwyEngagement;
}

export function EngagementDashboard({ engagement }: EngagementDashboardProps) {
  const { t } = useTranslation();
  const config = ENGAGEMENT_STATUS_CONFIG[engagement.status];
  const packageName = engagement.package?.name || 'DWY Package';

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t('dwyPackages.engagementDashboard.toBeDetermined');
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysRemaining = () => {
    if (!engagement.expected_end_at) return null;
    const days = Math.ceil(
      (new Date(engagement.expected_end_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return days > 0 ? days : 0;
  };

  const daysRemaining = getDaysRemaining();

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold">{packageName}</h3>
            <p className="text-purple-200 mt-1">{t('dwyPackages.engagementDashboard.activeEngagement')}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium bg-white/20`}>
            {t(`dwyPackages.types.engagementStatus.${engagement.status}`)}
          </span>
        </div>
      </div>

      {/* Timeline info */}
      <div className="p-6 border-b border-gray-100">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-sm text-gray-500">{t('dwyPackages.engagementDashboard.startedLabel')}</div>
            <div className="font-medium text-gray-900">{formatDate(engagement.started_at)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">{t('dwyPackages.engagementDashboard.targetCompletionLabel')}</div>
            <div className="font-medium text-gray-900">{formatDate(engagement.expected_end_at)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">{t('dwyPackages.engagementDashboard.daysRemainingLabel')}</div>
            <div className="font-medium text-gray-900">
              {daysRemaining !== null ? t('dwyPackages.engagementDashboard.daysValue', { count: daysRemaining }) : t('dwyPackages.engagementDashboard.notAvailable')}
            </div>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="p-6 border-b border-gray-100">
        <h4 className="font-medium text-gray-900 mb-3">{t('dwyPackages.engagementDashboard.quickLinksTitle')}</h4>
        <div className="flex flex-wrap gap-2">
          {engagement.scope_document_url && (
            <a
              href={engagement.scope_document_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t('dwyPackages.engagementDashboard.scopeDocument')}
            </a>
          )}
          {engagement.project_folder_url && (
            <a
              href={engagement.project_folder_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              {t('dwyPackages.engagementDashboard.projectFolder')}
            </a>
          )}
          {engagement.slack_channel && (
            <a
              href={`https://slack.com/app_redirect?channel=${engagement.slack_channel}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {t('dwyPackages.engagementDashboard.slackChannel')}
            </a>
          )}
        </div>
        {!engagement.scope_document_url && !engagement.project_folder_url && !engagement.slack_channel && (
          <p className="text-gray-500 text-sm">{t('dwyPackages.engagementDashboard.linksOnboarding')}</p>
        )}
      </div>

      {/* Milestones */}
      {engagement.milestones && engagement.milestones.length > 0 && (
        <div className="p-6">
          <EngagementMilestones milestones={engagement.milestones} />
        </div>
      )}

      {/* Notes */}
      {engagement.notes && (
        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <h4 className="font-medium text-gray-900 mb-2">{t('dwyPackages.engagementDashboard.notesTitle')}</h4>
          <p className="text-gray-600 text-sm whitespace-pre-wrap">{engagement.notes}</p>
        </div>
      )}
    </div>
  );
}

export default EngagementDashboard;
