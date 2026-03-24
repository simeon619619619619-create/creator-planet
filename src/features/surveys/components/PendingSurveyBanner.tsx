// =============================================================================
// PENDING SURVEY BANNER
// Shows a banner when students have pending surveys in a community
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, X, ChevronRight, Loader2 } from 'lucide-react';
import { getStudentPendingSurveysForCommunity } from '../surveyService';
import type { PendingSurvey } from '../surveyTypes';
import SurveyPlayer from './SurveyPlayer';

interface PendingSurveyBannerProps {
  studentId: string;
  communityId: string;
}

const DISMISS_KEY_PREFIX = 'survey_banner_dismissed_';

const PendingSurveyBanner: React.FC<PendingSurveyBannerProps> = ({
  studentId,
  communityId,
}) => {
  const { t } = useTranslation();
  const [pendingSurveys, setPendingSurveys] = useState<PendingSurvey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showSurveyPlayer, setShowSurveyPlayer] = useState(false);
  const [currentSurveyId, setCurrentSurveyId] = useState<string | null>(null);

  // Check if banner was dismissed in this session
  const getDismissKey = useCallback(() => {
    return `${DISMISS_KEY_PREFIX}${communityId}_${studentId}`;
  }, [communityId, studentId]);

  // Load pending surveys
  const loadPendingSurveys = useCallback(async () => {
    try {
      setIsLoading(true);
      const surveys = await getStudentPendingSurveysForCommunity(studentId, communityId);
      setPendingSurveys(surveys);

      // Check sessionStorage for dismiss state
      const dismissedAt = sessionStorage.getItem(getDismissKey());
      if (dismissedAt) {
        // Only stay dismissed if it was within the last 30 minutes
        const dismissTime = new Date(dismissedAt).getTime();
        const now = new Date().getTime();
        const thirtyMinutes = 30 * 60 * 1000;
        if (now - dismissTime < thirtyMinutes) {
          setIsDismissed(true);
        } else {
          // Clear old dismissal
          sessionStorage.removeItem(getDismissKey());
        }
      }
    } catch (error) {
      console.error('Failed to load pending surveys:', error);
    } finally {
      setIsLoading(false);
    }
  }, [studentId, communityId, getDismissKey]);

  useEffect(() => {
    loadPendingSurveys();
  }, [loadPendingSurveys]);

  // Handle dismiss
  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem(getDismissKey(), new Date().toISOString());
  };

  // Handle fill now click
  const handleFillNow = () => {
    if (pendingSurveys.length > 0) {
      setCurrentSurveyId(pendingSurveys[0].survey_id);
      setShowSurveyPlayer(true);
    }
  };

  // Handle survey completion
  const handleSurveyComplete = async () => {
    setShowSurveyPlayer(false);
    setCurrentSurveyId(null);
    // Reload surveys to check if there are more
    await loadPendingSurveys();
    // Clear dismiss state since they completed a survey
    sessionStorage.removeItem(getDismissKey());
    setIsDismissed(false);
  };

  // Handle survey close (without completion)
  const handleSurveyClose = () => {
    setShowSurveyPlayer(false);
    setCurrentSurveyId(null);
  };

  // Don't render if loading, no surveys, or dismissed
  if (isLoading || pendingSurveys.length === 0 || isDismissed) {
    return null;
  }

  const surveyCount = pendingSurveys.length;

  return (
    <>
      {/* Banner */}
      <div className="bg-[#EAB308]/5 border border-[#EAB308]/20 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="shrink-0 w-10 h-10 bg-[#EAB308]/10 rounded-lg flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-[#EAB308]" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[var(--fc-section-text,#FAFAFA)]">
              {t('surveys.banner.title')}
            </h3>
            <p className="text-sm text-[#EAB308] mt-0.5">
              {t('surveys.banner.description', { count: surveyCount })}
            </p>
          </div>

          {/* Actions */}
          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 text-sm text-[#EAB308] hover:text-[var(--fc-section-text,#FAFAFA)] hover:bg-[#EAB308]/10 rounded-lg transition-colors"
            >
              {t('surveys.banner.dismiss')}
            </button>
            <button
              onClick={handleFillNow}
              className="px-4 py-1.5 bg-[#EAB308] text-white text-sm font-medium rounded-lg hover:bg-[#EAB308]/80 transition-colors flex items-center gap-1"
            >
              {t('surveys.banner.fillNow')}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Close button (mobile-friendly alternative) */}
          <button
            onClick={handleDismiss}
            className="shrink-0 p-1 text-[#EAB308] hover:text-[#EAB308] hover:bg-[#EAB308]/10 rounded-lg transition-colors lg:hidden"
            aria-label={t('surveys.banner.dismiss')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Survey Player Modal */}
      {showSurveyPlayer && currentSurveyId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--fc-section,#0A0A0A)] rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-[var(--fc-section-border,#1F1F1F)] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--fc-section-text,#FAFAFA)]">
                {pendingSurveys.find(s => s.survey_id === currentSurveyId)?.survey_title || t('surveys.banner.title')}
              </h2>
              <button
                onClick={handleSurveyClose}
                className="p-2 text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-section-muted,#A0A0A0)] hover:bg-[var(--fc-section-hover,#1F1F1F)] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Survey Player Content */}
            <div className="flex-1 overflow-y-auto">
              <SurveyPlayer
                surveyId={currentSurveyId}
                studentId={studentId}
                onComplete={handleSurveyComplete}
                onClose={handleSurveyClose}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PendingSurveyBanner;
