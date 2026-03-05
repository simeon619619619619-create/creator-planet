// =============================================================================
// MyApplications Component
// Lists all of the user's DWY package applications
// =============================================================================

import { useTranslation } from 'react-i18next';
import { ApplicationStatus } from './ApplicationStatus';
import type { DwyApplication } from '../dwyTypes';

interface MyApplicationsProps {
  applications: DwyApplication[];
  isLoading: boolean;
  onWithdraw: (id: string) => void;
}

export function MyApplications({ applications, isLoading, onWithdraw }: MyApplicationsProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl p-6 animate-pulse">
            <div className="h-6 bg-[#1F1F1F] rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-[#1F1F1F] rounded w-1/2 mb-6"></div>
            <div className="flex gap-4">
              {[1, 2, 3].map(j => (
                <div key={j} className="h-8 w-8 bg-[#1F1F1F] rounded-full"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-[#666666] mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-[#FAFAFA] mb-1">{t('dwyPackages.myApplications.noApplicationsTitle')}</h3>
        <p className="text-[#666666]">{t('dwyPackages.myApplications.noApplicationsDescription')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {applications.map(application => (
        <ApplicationStatus
          key={application.id}
          application={application}
          onWithdraw={
            application.status === 'pending'
              ? () => onWithdraw(application.id)
              : undefined
          }
        />
      ))}
    </div>
  );
}

export default MyApplications;
