// =============================================================================
// SURVEY RESPONSES VIEWER
// Creator-facing component for viewing survey responses
// =============================================================================

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Download,
  Search,
  ChevronDown,
  ChevronRight,
  User,
  Calendar,
  Loader2,
  FileSpreadsheet,
  X,
  AlertCircle,
} from 'lucide-react';
import type { SurveyWithDetails, SurveyResponseWithDetails, SurveyQuestion } from '../surveyTypes';
import { getSurvey, getSurveyResponses, exportSurveyResponses, downloadCsv } from '../surveyService';

// =============================================================================
// Response Detail View
// =============================================================================

interface ResponseDetailProps {
  response: SurveyResponseWithDetails;
  questions: SurveyQuestion[];
  onClose: () => void;
}

const ResponseDetail: React.FC<ResponseDetailProps> = ({ response, questions, onClose }) => {
  const { t } = useTranslation();

  const getAnswerDisplay = (questionId: string): string => {
    const answer = response.answers.find((a) => a.question_id === questionId);
    if (!answer) return '—';

    const value = answer.answer_value;
    let display: string;

    if (Array.isArray(value)) {
      display = value.join(', ');
    } else {
      display = String(value);
    }

    if (answer.other_value) {
      display += ` (${answer.other_value})`;
    }

    return display || '—';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src={
                response.student.avatar_url ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(response.student.full_name)}&background=6366f1&color=fff&size=64`
              }
              alt={response.student.full_name}
              className="w-12 h-12 rounded-full object-cover"
            />
            <div>
              <h2 className="font-semibold text-slate-900">{response.student.full_name}</h2>
              <p className="text-sm text-slate-500">
                {response.submitted_at
                  ? new Date(response.submitted_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : t('surveys.responses.notSubmitted')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {questions.map((question, index) => (
              <div key={question.id} className="border-b border-slate-100 pb-4 last:border-0">
                <div className="flex gap-3">
                  <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded text-sm font-medium flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700 mb-2">{question.question_text}</p>
                    <p className="text-slate-900">{getAnswerDisplay(question.id)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Main Survey Responses Component
// =============================================================================

interface SurveyResponsesProps {
  surveyId: string;
  onClose: () => void;
}

const SurveyResponses: React.FC<SurveyResponsesProps> = ({ surveyId, onClose }) => {
  const { t } = useTranslation();
  const [survey, setSurvey] = useState<SurveyWithDetails | null>(null);
  const [responses, setResponses] = useState<SurveyResponseWithDetails[]>([]);
  const [filteredResponses, setFilteredResponses] = useState<SurveyResponseWithDetails[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResponse, setSelectedResponse] = useState<SurveyResponseWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [surveyData, responsesData] = await Promise.all([
          getSurvey(surveyId),
          getSurveyResponses(surveyId),
        ]);

        if (!surveyData) {
          setError(t('surveys.responses.notFound'));
          return;
        }

        setSurvey(surveyData);
        setResponses(responsesData);
        setFilteredResponses(responsesData);
      } catch (err) {
        console.error('Failed to load responses:', err);
        setError(t('surveys.responses.loadError'));
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [surveyId, t]);

  // Filter responses by search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredResponses(responses);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredResponses(
        responses.filter((r) => r.student.full_name.toLowerCase().includes(query))
      );
    }
  }, [searchQuery, responses]);

  // Export to CSV
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const csvContent = await exportSurveyResponses(surveyId);
      const filename = `${survey?.title || 'survey'}-responses-${new Date().toISOString().split('T')[0]}.csv`;
      downloadCsv(csvContent, filename);
    } catch (err) {
      console.error('Failed to export:', err);
      alert(t('surveys.responses.exportError'));
    } finally {
      setIsExporting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error || !survey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <p className="mt-4 text-slate-600">{error}</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            {t('common.goBack')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">{survey.title}</h1>
                <p className="text-sm text-slate-500">
                  {responses.length} {t('surveys.responses.count', { count: responses.length })}
                </p>
              </div>
            </div>
            <button
              onClick={handleExport}
              disabled={isExporting || responses.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {t('surveys.responses.exportCsv')}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {responses.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
            <FileSpreadsheet className="w-16 h-16 text-slate-300 mx-auto" />
            <h3 className="mt-4 text-lg font-medium text-slate-900">
              {t('surveys.responses.noResponses')}
            </h3>
            <p className="mt-2 text-slate-500">{t('surveys.responses.noResponsesDesc')}</p>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('surveys.responses.searchPlaceholder')}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Responses List */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                      {t('surveys.responses.student')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                      {t('surveys.responses.submittedAt')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                      {t('surveys.responses.answers')}
                    </th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredResponses.map((response) => (
                    <tr
                      key={response.id}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => setSelectedResponse(response)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              response.student.avatar_url ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(response.student.full_name)}&background=6366f1&color=fff&size=40`
                            }
                            alt={response.student.full_name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <span className="font-medium text-slate-900">
                            {response.student.full_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {response.submitted_at
                          ? new Date(response.submitted_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {response.answers.length} / {survey.questions.length}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Response Detail Modal */}
      {selectedResponse && (
        <ResponseDetail
          response={selectedResponse}
          questions={survey.questions}
          onClose={() => setSelectedResponse(null)}
        />
      )}
    </div>
  );
};

export default SurveyResponses;
