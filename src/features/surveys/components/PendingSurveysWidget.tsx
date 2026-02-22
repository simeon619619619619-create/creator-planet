// =============================================================================
// PENDING SURVEYS WIDGET
// Dashboard widget showing surveys the student needs to complete
// =============================================================================

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ClipboardCheck,
  X,
  Loader2,
  ChevronRight,
  Users,
} from 'lucide-react';
import type { PendingSurvey } from '../surveyTypes';
import { getStudentPendingSurveys } from '../surveyService';
import SurveyPlayer from './SurveyPlayer';

interface PendingSurveysWidgetProps {
  studentId: string;
}

const PendingSurveysWidget: React.FC<PendingSurveysWidgetProps> = ({ studentId }) => {
  const { t } = useTranslation();
  const [pendingSurveys, setPendingSurveys] = useState<PendingSurvey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSurvey, setSelectedSurvey] = useState<PendingSurvey | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Load pending surveys
  useEffect(() => {
    const loadPendingSurveys = async () => {
      try {
        const surveys = await getStudentPendingSurveys(studentId);
        setPendingSurveys(surveys);
      } catch (error) {
        console.error('Error loading pending surveys:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (studentId) {
      loadPendingSurveys();
    }
  }, [studentId]);

  // Handle opening a survey
  const handleOpenSurvey = (survey: PendingSurvey) => {
    setSelectedSurvey(survey);
    setShowModal(true);
  };

  // Handle closing the modal
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedSurvey(null);
  };

  // Handle survey completion
  const handleSurveyComplete = () => {
    // Remove the completed survey from the list
    if (selectedSurvey) {
      setPendingSurveys((prev) => prev.filter((s) => s.id !== selectedSurvey.id));
    }
    // Modal will close when user clicks "Continue" in SurveyPlayer
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-amber-100 rounded-lg">
            <ClipboardCheck className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{t('surveys.pending.title')}</h3>
          </div>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-amber-600 animate-spin" />
        </div>
      </div>
    );
  }

  // Empty state - don't render widget if no pending surveys
  if (pendingSurveys.length === 0) {
    return null;
  }

  return (
    <>
      {/* Widget Card */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-amber-100 rounded-lg">
            <ClipboardCheck className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{t('surveys.pending.title')}</h3>
            <p className="text-sm text-slate-500">
              {pendingSurveys.length === 1
                ? t('surveys.pending.countSingle')
                : t('surveys.pending.count', { count: pendingSurveys.length })}
            </p>
          </div>
        </div>

        {/* Survey List */}
        <div className="space-y-3">
          {pendingSurveys.map((survey) => (
            <div
              key={survey.id}
              className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-lg hover:bg-amber-100 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-slate-900 truncate">{survey.survey_title}</h4>
                {survey.community_name && (
                  <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                    <Users className="w-3.5 h-3.5" />
                    {t('surveys.pending.from', { community: survey.community_name })}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleOpenSurvey(survey)}
                className="ml-3 flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors shrink-0"
              >
                {t('surveys.pending.fillSurvey')}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Survey Modal */}
      {showModal && selectedSurvey && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={handleCloseModal}
          />

          {/* Modal Container */}
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              {/* Close Button */}
              <button
                onClick={handleCloseModal}
                className="absolute top-4 right-4 z-10 p-2 bg-white/90 hover:bg-white rounded-full shadow-md transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>

              {/* Survey Player */}
              <div className="overflow-y-auto max-h-[90vh]">
                <SurveyPlayer
                  surveyId={selectedSurvey.survey_id}
                  studentId={studentId}
                  onComplete={handleSurveyComplete}
                  onClose={handleCloseModal}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PendingSurveysWidget;
