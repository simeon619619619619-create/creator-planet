import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ClipboardList,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Calendar,
  Award,
  FileText,
  ChevronRight,
  ClipboardCheck,
  X,
  Users,
} from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import {
  getAssignments,
  getStudentSubmissions,
  submitHomework,
} from './homeworkService';
import { getStudentPendingSurveysForCommunity } from '../surveys/surveyService';
import type { PendingSurvey } from '../surveys/surveyTypes';
import SurveyPlayer from '../surveys/components/SurveyPlayer';
import HomeworkSubmissionModal from './HomeworkSubmissionModal';
import type {
  DbHomeworkAssignment,
  DbHomeworkAssignmentWithStats,
  DbHomeworkSubmission,
} from '../../core/supabase/database.types';

interface HomeworkPageProps {
  communityId: string;
}

const HomeworkPage: React.FC<HomeworkPageProps> = ({ communityId }) => {
  const { t } = useTranslation();
  const { profile } = useAuth();

  // State
  const [assignments, setAssignments] = useState<DbHomeworkAssignmentWithStats[]>([]);
  const [submissions, setSubmissions] = useState<(DbHomeworkSubmission & { assignment: DbHomeworkAssignment })[]>([]);
  const [pendingSurveys, setPendingSurveys] = useState<PendingSurvey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<DbHomeworkAssignment | null>(null);
  const [selectedSurvey, setSelectedSurvey] = useState<PendingSurvey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      if (!profile?.id) return;

      setIsLoading(true);
      try {
        // Get all published assignments for this community
        const allAssignments = await getAssignments(communityId, false);
        setAssignments(allAssignments);

        // Get student's submissions
        const studentSubmissions = await getStudentSubmissions(profile.id, communityId);
        setSubmissions(studentSubmissions);

        // Get pending surveys for this community
        const surveys = await getStudentPendingSurveysForCommunity(profile.id, communityId);
        setPendingSurveys(surveys);
      } catch (error) {
        console.error('Error loading homework data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [communityId, profile?.id]);

  // Get submitted assignment IDs
  const submittedAssignmentIds = new Set(submissions.map((s) => s.assignment_id));

  // Filter pending assignments (not yet submitted)
  const pendingAssignments = assignments.filter(
    (a) => !submittedAssignmentIds.has(a.id)
  );

  // Handle submission
  const handleSubmit = async (textResponse: string, fileUrls: string[]) => {
    if (!profile?.id || !selectedAssignment) return;

    setIsSubmitting(true);
    try {
      const result = await submitHomework(
        selectedAssignment.id,
        profile.id,
        textResponse,
        fileUrls
      );

      if (!result) {
        // submitHomework returns null on duplicate or error - throw so modal shows error
        throw new Error(t('homework.errors.submissionError'));
      }

      // Refresh submissions
      const updatedSubmissions = await getStudentSubmissions(profile.id, communityId);
      setSubmissions(updatedSubmissions);

      // Close modal on success
      setSelectedAssignment(null);
    } catch (error) {
      console.error('Error submitting homework:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Check if assignment is past due
  const isPastDue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  // Handle survey completion
  const handleSurveyComplete = () => {
    if (selectedSurvey) {
      setPendingSurveys((prev) => prev.filter((s) => s.id !== selectedSurvey.id));
    }
    setSelectedSurvey(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-100 rounded-xl">
              <ClipboardList className="w-7 h-7 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{t('homework.page.title')}</h1>
              <p className="text-slate-600">
                {t('homework.page.subtitle')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {pendingAssignments.length}
                </p>
                <p className="text-sm text-slate-600">{t('homework.stats.pending')}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {submissions.length}
                </p>
                <p className="text-sm text-slate-600">{t('homework.stats.submitted')}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-100 rounded-lg">
                <Award className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {submissions.filter((s) => s.status === 'graded').reduce(
                    (sum, s) => sum + (s.points_awarded || 0),
                    0
                  )}
                </p>
                <p className="text-sm text-slate-600">{t('homework.stats.pointsEarned')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Surveys Section */}
        {pendingSurveys.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-amber-500" />
              {t('homework.pendingSurveys.sectionTitle')}
            </h2>
            <div className="space-y-4">
              {pendingSurveys.slice(0, 3).map((survey) => (
                <div
                  key={survey.id}
                  className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-5 hover:shadow-md hover:border-amber-300 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900 text-lg">
                          {survey.survey_title}
                        </h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          {t('homework.pendingSurveys.surveyBadge')}
                        </span>
                      </div>
                      {survey.survey_description && (
                        <p className="text-slate-600 mt-1 line-clamp-2">
                          {survey.survey_description}
                        </p>
                      )}
                      {survey.community_name && (
                        <p className="text-sm text-slate-500 mt-2 flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {survey.community_name}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedSurvey(survey)}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium whitespace-nowrap"
                    >
                      {t('homework.pendingSurveys.fillButton')}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {pendingSurveys.length > 3 && (
                <p className="text-sm text-amber-600 mt-2">
                  {t('homework.pendingSurveys.moreCount', { count: pendingSurveys.length - 3 })}
                </p>
              )}
            </div>
          </section>
        )}

        {/* Pending Assignments Section */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            {t('homework.pendingAssignments.sectionTitle')}
          </h2>

          {pendingAssignments.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-900">
                {t('homework.pendingAssignments.emptyTitle')}
              </h3>
              <p className="text-slate-600 mt-1">
                {t('homework.pendingAssignments.emptyMessage')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-indigo-200 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 text-lg">
                        {assignment.title}
                      </h3>
                      {assignment.description && (
                        <p className="text-slate-600 mt-1 line-clamp-2">
                          {assignment.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-sm">
                        <span className="flex items-center gap-1 text-indigo-600 font-medium">
                          <Award className="w-4 h-4" />
                          {assignment.max_points} {t('homework.pendingAssignments.pointsLabel')}
                        </span>
                        {assignment.due_date && (
                          <span
                            className={`flex items-center gap-1 ${
                              isPastDue(assignment.due_date)
                                ? 'text-red-600'
                                : 'text-slate-500'
                            }`}
                          >
                            <Calendar className="w-4 h-4" />
                            {t('homework.pendingAssignments.dueLabel')} {formatDate(assignment.due_date)}
                            {isPastDue(assignment.due_date) && (
                              <AlertCircle className="w-4 h-4 text-red-500" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedAssignment(assignment)}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium whitespace-nowrap"
                    >
                      {t('homework.pendingAssignments.submitButton')}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* My Submissions Section */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            {t('homework.mySubmissions.sectionTitle')}
          </h2>

          {submissions.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-900">
                {t('homework.mySubmissions.emptyTitle')}
              </h3>
              <p className="text-slate-600 mt-1">
                {t('homework.mySubmissions.emptyMessage')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((submission) => (
                <div
                  key={submission.id}
                  className="bg-white rounded-xl border border-slate-200 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-slate-900">
                          {submission.assignment.title}
                        </h3>
                        {submission.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                            <Clock className="w-3 h-3" />
                            {t('homework.mySubmissions.pendingReviewStatus')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            <CheckCircle className="w-3 h-3" />
                            {t('homework.mySubmissions.gradedStatus')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-1">
                        {t('homework.mySubmissions.submittedOnLabel')} {formatDate(submission.submitted_at)}
                      </p>

                      {/* Show graded info */}
                      {submission.status === 'graded' && (
                        <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1 text-green-600 font-semibold">
                              <Award className="w-4 h-4" />
                              {submission.points_awarded} / {submission.assignment.max_points} {t('homework.pendingAssignments.pointsLabel')}
                            </div>
                            {submission.graded_at && (
                              <span className="text-sm text-slate-500">
                                {t('homework.mySubmissions.gradedOnLabel')} {formatDate(submission.graded_at)}
                              </span>
                            )}
                          </div>
                          {submission.feedback && (
                            <div className="mt-2">
                              <p className="text-sm font-medium text-slate-700">
                                {t('homework.mySubmissions.feedbackLabel')}
                              </p>
                              <p className="text-sm text-slate-600 mt-1">
                                {submission.feedback.length > 200
                                  ? `${submission.feedback.slice(0, 200)}...`
                                  : submission.feedback}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Submission Modal */}
      {selectedAssignment && profile && (
        <HomeworkSubmissionModal
          assignment={selectedAssignment}
          studentId={profile.id}
          isOpen={!!selectedAssignment}
          onClose={() => setSelectedAssignment(null)}
          onSubmit={handleSubmit}
        />
      )}

      {/* Survey Modal */}
      {selectedSurvey && profile && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={() => setSelectedSurvey(null)}
          />

          {/* Modal Container */}
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              {/* Close Button */}
              <button
                onClick={() => setSelectedSurvey(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-white/90 hover:bg-white rounded-full shadow-md transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>

              {/* Survey Player */}
              <div className="overflow-y-auto max-h-[90vh]">
                <SurveyPlayer
                  surveyId={selectedSurvey.survey_id}
                  studentId={profile.id}
                  onComplete={handleSurveyComplete}
                  onClose={() => setSelectedSurvey(null)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeworkPage;
