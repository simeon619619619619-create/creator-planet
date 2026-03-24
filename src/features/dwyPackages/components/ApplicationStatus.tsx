// =============================================================================
// ApplicationStatus Component
// Shows the status of a single application with progress tracking
// =============================================================================

import { useTranslation } from 'react-i18next';
import type { DwyApplication } from '../dwyTypes';
import { APPLICATION_STATUS_CONFIG } from '../dwyTypes';

interface ApplicationStatusProps {
  application: DwyApplication;
  onWithdraw?: () => void;
}

const statusOrder = ['pending', 'under_review', 'interview_scheduled', 'approved', 'converted'] as const;

export function ApplicationStatus({ application, onWithdraw }: ApplicationStatusProps) {
  const { t } = useTranslation();
  const config = APPLICATION_STATUS_CONFIG[application.status];
  const packageName = application.package?.name || 'DWY Package';

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getCurrentStep = () => {
    if (['rejected', 'withdrawn'].includes(application.status)) return -1;
    return statusOrder.indexOf(application.status as typeof statusOrder[number]);
  };

  const currentStep = getCurrentStep();
  const canWithdraw = application.status === 'pending' && onWithdraw;

  return (
    <div className="bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-xl p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="font-semibold text-[var(--fc-section-text,#FAFAFA)] text-lg">{packageName}</h3>
          <p className="text-sm text-[var(--fc-section-muted,#666666)]">
            {t('dwyPackages.applicationStatus.appliedOn', { date: formatDate(application.submitted_at) })}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
          {t(`dwyPackages.types.applicationStatus.${application.status === 'under_review' ? 'underReview' : application.status === 'interview_scheduled' ? 'interviewScheduled' : application.status}`)}
        </span>
      </div>

      {/* Progress tracker for active applications */}
      {currentStep >= 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between">
            {statusOrder.map((status, index) => (
              <div key={status} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      index <= currentStep
                        ? 'bg-[var(--fc-text,white)] text-[var(--fc-surface,black)]'
                        : 'bg-[var(--fc-section-hover,#1F1F1F)] text-[var(--fc-section-muted,#666666)]'
                    }`}
                  >
                    {index < currentStep ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className={`text-xs mt-1 ${index <= currentStep ? 'text-[var(--fc-section-text,#FAFAFA)]' : 'text-[var(--fc-section-muted,#666666)]'}`}>
                    {status === 'pending' && t('dwyPackages.applicationStatus.stepSubmitted')}
                    {status === 'under_review' && t('dwyPackages.applicationStatus.stepReview')}
                    {status === 'interview_scheduled' && t('dwyPackages.applicationStatus.stepInterview')}
                    {status === 'approved' && t('dwyPackages.applicationStatus.stepApproved')}
                    {status === 'converted' && t('dwyPackages.applicationStatus.stepActive')}
                  </span>
                </div>
                {index < statusOrder.length - 1 && (
                  <div
                    className={`w-16 h-0.5 mx-2 ${
                      index < currentStep ? 'bg-white' : 'bg-[var(--fc-section-hover,#1F1F1F)]'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interview info */}
      {application.status === 'interview_scheduled' && application.interview_scheduled_at && (
        <div className="bg-[var(--fc-section-hover,#151515)] border border-[var(--fc-section-border,#1F1F1F)] rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-[var(--fc-section-text,#FAFAFA)] font-medium mb-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {t('dwyPackages.applicationStatus.interviewScheduled')}
          </div>
          <p className="text-[var(--fc-section-muted,#A0A0A0)]">
            {new Date(application.interview_scheduled_at).toLocaleString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
          {application.interview_link && (
            <a
              href={application.interview_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-sm text-[var(--fc-section-text,#FAFAFA)] hover:text-[var(--fc-section-muted,#A0A0A0)] underline"
            >
              {t('dwyPackages.applicationStatus.joinInterview')}
            </a>
          )}
        </div>
      )}

      {/* Rejection reason */}
      {application.status === 'rejected' && application.decision_reason && (
        <div className="bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-lg p-4 mb-4">
          <div className="text-sm text-[var(--fc-section-muted,#A0A0A0)]">
            <span className="font-medium">{t('dwyPackages.applicationStatus.feedbackLabel')} </span>
            {application.decision_reason}
          </div>
        </div>
      )}

      {/* Application summary */}
      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <span className="text-[var(--fc-section-muted,#666666)]">{t('dwyPackages.applicationStatus.businessLabel')}</span>
          <span className="ml-2 text-[var(--fc-section-text,#FAFAFA)]">{application.business_name || '-'}</span>
        </div>
        <div>
          <span className="text-[var(--fc-section-muted,#666666)]">{t('dwyPackages.applicationStatus.revenueLabel')}</span>
          <span className="ml-2 text-[var(--fc-section-text,#FAFAFA)]">{application.current_revenue || '-'}</span>
        </div>
      </div>

      {/* Actions */}
      {canWithdraw && (
        <div className="pt-4 border-t border-[var(--fc-section-border,#1F1F1F)]">
          <button
            onClick={onWithdraw}
            className="text-sm text-[#EF4444] hover:text-[#EF4444]"
          >
            {t('dwyPackages.applicationStatus.withdrawApplication')}
          </button>
        </div>
      )}
    </div>
  );
}

export default ApplicationStatus;
