import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Loader2,
  Check,
  X,
  User,
  Calendar,
  MessageSquare,
  Inbox,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  getCreatorApplications,
  approveApplication,
  rejectApplication,
} from '../community/communityService';
import type { ApplicationWithApplicant } from '../community/communityTypes';
import { Avatar } from '../../shared/Avatar';

interface ApplicationsTabProps {
  creatorId: string;
  onApplicationsChange?: () => void;
}

export const ApplicationsTab: React.FC<ApplicationsTabProps> = ({
  creatorId,
  onApplicationsChange,
}) => {
  const { t } = useTranslation();
  const [applications, setApplications] = useState<ApplicationWithApplicant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load applications
  const loadApplications = async () => {
    setIsLoading(true);
    try {
      const data = await getCreatorApplications(creatorId);
      setApplications(data);
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, [creatorId]);

  // Handle approve
  const handleApprove = async (applicationId: string) => {
    setProcessingId(applicationId);
    try {
      const success = await approveApplication(applicationId, creatorId);
      if (success) {
        // Remove from list
        setApplications((prev) => prev.filter((app) => app.id !== applicationId));
        onApplicationsChange?.();
      }
    } catch (error) {
      console.error('Error approving application:', error);
    } finally {
      setProcessingId(null);
    }
  };

  // Handle reject
  const handleReject = async (applicationId: string) => {
    setProcessingId(applicationId);
    try {
      const success = await rejectApplication(applicationId, creatorId);
      if (success) {
        // Remove from list
        setApplications((prev) => prev.filter((app) => app.id !== applicationId));
        onApplicationsChange?.();
      }
    } catch (error) {
      console.error('Error rejecting application:', error);
    } finally {
      setProcessingId(null);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto" />
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="p-12 text-center">
        <Inbox className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-slate-700">
          {t('studentManager.applications.empty.title')}
        </h3>
        <p className="text-slate-500 mt-2">
          {t('studentManager.applications.empty.description')}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {applications.map((application) => {
        const isProcessing = processingId === application.id;
        const isExpanded = expandedId === application.id;
        const hasMessage = application.message && application.message.trim().length > 0;

        return (
          <div key={application.id} className="p-4 hover:bg-slate-50 transition-colors">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <Avatar
                src={application.applicant.avatar_url}
                name={application.applicant.full_name}
                size="md"
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-900">
                      {application.applicant.full_name || 'Unknown User'}
                    </p>
                    {application.community && (
                      <span className="inline-flex items-center px-2 py-0.5 mt-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                        {application.community.name}
                      </span>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(application.applied_at)}
                      </span>
                      {hasMessage && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : application.id)}
                          className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          {t('studentManager.applications.viewMessage')}
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleReject(application.id)}
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                      {t('studentManager.applications.reject')}
                    </button>
                    <button
                      onClick={() => handleApprove(application.id)}
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      {t('studentManager.applications.approve')}
                    </button>
                  </div>
                </div>

                {/* Expanded Message */}
                {isExpanded && hasMessage && (
                  <div className="mt-3 p-3 bg-slate-100 rounded-lg text-sm text-slate-700">
                    <p className="whitespace-pre-wrap">{application.message}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
