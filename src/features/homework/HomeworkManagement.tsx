import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  ClipboardList,
  Users,
  Eye,
  EyeOff,
  Loader2,
  Edit2,
  Clock,
  CheckCircle,
  Award,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import {
  getAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getSubmissionsForAssignment,
  gradeSubmission,
} from './homeworkService';
import AssignmentEditModal from './AssignmentEditModal';
import GradingModal from './GradingModal';
import type {
  DbHomeworkAssignment,
  DbHomeworkAssignmentWithStats,
  DbHomeworkSubmissionWithStudent,
} from '../../core/supabase/database.types';

interface HomeworkManagementProps {
  communityId: string;
  creatorProfileId: string;
}

type SubmissionFilter = 'all' | 'pending' | 'graded';

const HomeworkManagement: React.FC<HomeworkManagementProps> = ({
  communityId,
  creatorProfileId,
}) => {
  const { t } = useTranslation();
  const { profile } = useAuth();

  // State
  const [assignments, setAssignments] = useState<DbHomeworkAssignmentWithStats[]>([]);
  const [submissions, setSubmissions] = useState<DbHomeworkSubmissionWithStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<DbHomeworkAssignmentWithStats | null>(null);
  const [submissionFilter, setSubmissionFilter] = useState<SubmissionFilter>('pending');

  // Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<DbHomeworkAssignment | null>(null);
  const [isGradingModalOpen, setIsGradingModalOpen] = useState(false);
  const [gradingSubmission, setGradingSubmission] = useState<DbHomeworkSubmissionWithStudent | null>(null);

  // Calculate total pending reviews
  const totalPendingReviews = assignments.reduce((sum, a) => sum + a.pending_count, 0);

  // Load assignments
  const loadAssignments = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAssignments(communityId, true); // Include unpublished
      setAssignments(data);

      // If we have a selected assignment, check if it still exists
      if (selectedAssignment) {
        const stillExists = data.find((a) => a.id === selectedAssignment.id);
        if (stillExists) {
          setSelectedAssignment(stillExists);
        } else {
          setSelectedAssignment(null);
        }
      }
    } catch (error) {
      console.error('Error loading assignments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [communityId, selectedAssignment]);

  // Load submissions for selected assignment
  const loadSubmissions = useCallback(async (assignmentId: string) => {
    setIsLoadingSubmissions(true);
    try {
      const data = await getSubmissionsForAssignment(assignmentId);
      setSubmissions(data);
    } catch (error) {
      console.error('Error loading submissions:', error);
    } finally {
      setIsLoadingSubmissions(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadAssignments();
  }, [communityId]);

  // Load submissions when assignment is selected
  useEffect(() => {
    if (selectedAssignment) {
      loadSubmissions(selectedAssignment.id);
    } else {
      setSubmissions([]);
    }
  }, [selectedAssignment?.id, loadSubmissions]);

  // Handle assignment click
  const handleAssignmentClick = (assignment: DbHomeworkAssignmentWithStats) => {
    setSelectedAssignment(assignment);
    setSubmissionFilter('pending'); // Reset filter when switching assignments
  };

  // Open create modal
  const handleCreateClick = () => {
    setEditingAssignment(null);
    setIsEditModalOpen(true);
  };

  // Open edit modal
  const handleEditClick = (e: React.MouseEvent, assignment: DbHomeworkAssignment) => {
    e.stopPropagation();
    setEditingAssignment(assignment);
    setIsEditModalOpen(true);
  };

  // Save assignment (create or update)
  const handleSaveAssignment = async (data: {
    title: string;
    description: string;
    maxPoints: number;
    dueDate: string | null;
  }) => {
    if (editingAssignment) {
      // Update existing
      const result = await updateAssignment(editingAssignment.id, {
        title: data.title,
        description: data.description || null,
        max_points: data.maxPoints,
        due_date: data.dueDate,
      });
      if (result) {
        await loadAssignments();
        setIsEditModalOpen(false);
      }
    } else {
      // Create new
      const result = await createAssignment(
        communityId,
        creatorProfileId,
        data.title,
        data.description || undefined,
        data.maxPoints,
        data.dueDate || undefined
      );
      if (result) {
        await loadAssignments();
        setIsEditModalOpen(false);
      }
    }
  };

  // Delete assignment
  const handleDeleteAssignment = async () => {
    if (!editingAssignment) return;

    const success = await deleteAssignment(editingAssignment.id);
    if (success) {
      if (selectedAssignment?.id === editingAssignment.id) {
        setSelectedAssignment(null);
      }
      await loadAssignments();
      setIsEditModalOpen(false);
    }
  };

  // Toggle publish status
  const handleTogglePublish = async () => {
    if (!selectedAssignment) return;

    const result = await updateAssignment(selectedAssignment.id, {
      is_published: !selectedAssignment.is_published,
    });
    if (result) {
      await loadAssignments();
    }
  };

  // Open grading modal
  const handleGradeClick = (submission: DbHomeworkSubmissionWithStudent) => {
    setGradingSubmission(submission);
    setIsGradingModalOpen(true);
  };

  // Handle grading submission
  const handleGrade = async (points: number, feedback: string | null) => {
    if (!gradingSubmission || !profile || !selectedAssignment) return;

    const result = await gradeSubmission(
      gradingSubmission.id,
      points,
      feedback,
      profile.id,
      gradingSubmission.student_id,
      communityId
    );

    if (result) {
      // Refresh both submissions and assignments (to update pending counts)
      await Promise.all([
        loadSubmissions(selectedAssignment.id),
        loadAssignments(),
      ]);
      setIsGradingModalOpen(false);
      setGradingSubmission(null);
    }
  };

  // Filter submissions
  const filteredSubmissions = submissions.filter((s) => {
    if (submissionFilter === 'all') return true;
    return s.status === submissionFilter;
  });

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-[#FAFAFA] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <div className="bg-[#0A0A0A] border-b border-[#1F1F1F]">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#1F1F1F] rounded-xl">
                <ClipboardList className="w-7 h-7 text-[#FAFAFA]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#FAFAFA]">{t('homeworkManagement.pageTitle')}</h1>
                <p className="text-[#A0A0A0]">
                  {t('homeworkManagement.pageSubtitle')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Pending Review Count */}
              {totalPendingReviews > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#EAB308]/10 text-[#EAB308] rounded-full">
                  <Clock className="w-4 h-4" />
                  <span className="font-medium">{totalPendingReviews} {t('homeworkManagement.pendingReviews')}</span>
                </div>
              )}

              {/* New Assignment Button */}
              <button
                onClick={handleCreateClick}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] rounded-lg hover:bg-[#E0E0E0] transition-colors font-medium"
              >
                <Plus className="w-5 h-5" />
                {t('homeworkManagement.buttons.newAssignment')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Assignment List */}
          <div className="col-span-4">
            <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] overflow-hidden">
              <div className="p-4 border-b border-[#1F1F1F]">
                <h2 className="font-semibold text-[#FAFAFA] flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-[#A0A0A0]" />
                  {t('homeworkManagement.assignments.title')}
                </h2>
              </div>

              {assignments.length === 0 ? (
                <div className="p-8 text-center">
                  <ClipboardList className="w-12 h-12 text-[#A0A0A0] mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-[#A0A0A0]">{t('homeworkManagement.assignments.emptyTitle')}</h3>
                  <p className="text-[#666666] mt-1 mb-4">
                    {t('homeworkManagement.assignments.emptyDescription')}
                  </p>
                  <button
                    onClick={handleCreateClick}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] rounded-lg hover:bg-[#E0E0E0] transition-colors font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    {t('homeworkManagement.buttons.createAssignment')}
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[#1F1F1F] max-h-[calc(100dvh-280px)] overflow-y-auto">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      onClick={() => handleAssignmentClick(assignment)}
                      className={`p-4 cursor-pointer transition-colors ${
                        selectedAssignment?.id === assignment.id
                          ? 'bg-[#151515] border-l-4 border-white'
                          : 'hover:bg-[#0A0A0A]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-[#FAFAFA] truncate">
                            {assignment.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            {assignment.is_published ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#22C55E]/10 text-[#22C55E] rounded text-xs font-medium">
                                <Eye className="w-3 h-3" />
                                {t('homeworkManagement.status.published')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#1F1F1F] text-[#A0A0A0] rounded text-xs font-medium">
                                <EyeOff className="w-3 h-3" />
                                {t('homeworkManagement.status.draft')}
                              </span>
                            )}
                            {assignment.pending_count > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#EAB308]/10 text-[#EAB308] rounded text-xs font-medium">
                                {assignment.pending_count} {t('homeworkManagement.status.pending')}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleEditClick(e, assignment)}
                          className="p-1.5 text-[#666666] hover:text-[#A0A0A0] hover:bg-[#1F1F1F] rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Submissions Queue */}
          <div className="col-span-8">
            {selectedAssignment ? (
              <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] overflow-hidden">
                {/* Assignment Header */}
                <div className="p-4 border-b border-[#1F1F1F]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-semibold text-[#FAFAFA] text-lg">
                        {selectedAssignment.title}
                      </h2>
                      {selectedAssignment.description && (
                        <p className="text-[#A0A0A0] text-sm mt-1 line-clamp-2">
                          {selectedAssignment.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-sm text-[#666666]">
                        <span className="flex items-center gap-1">
                          <Award className="w-4 h-4" />
                          {selectedAssignment.max_points} {t('homeworkManagement.assignment.points')}
                        </span>
                        {selectedAssignment.due_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {t('homeworkManagement.assignment.due')} {formatDate(selectedAssignment.due_date)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {selectedAssignment.total_submissions} {t('homeworkManagement.assignment.submissions')}
                        </span>
                      </div>
                    </div>

                    {/* Publish/Unpublish Toggle */}
                    <button
                      onClick={handleTogglePublish}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors ${
                        selectedAssignment.is_published
                          ? 'bg-[#1F1F1F] text-[#A0A0A0] hover:bg-[#151515]'
                          : 'bg-[#22C55E] text-white hover:bg-[#22C55E]/80'
                      }`}
                    >
                      {selectedAssignment.is_published ? (
                        <>
                          <EyeOff className="w-4 h-4" />
                          {t('homeworkManagement.buttons.unpublish')}
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" />
                          {t('homeworkManagement.buttons.publish')}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Filter Bar */}
                <div className="p-4 border-b border-[#1F1F1F] bg-[#0A0A0A]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#A0A0A0]">{t('homeworkManagement.filter.label')}</span>
                    <select
                      value={submissionFilter}
                      onChange={(e) => setSubmissionFilter(e.target.value as SubmissionFilter)}
                      className="px-3 py-1.5 border border-[#1F1F1F] rounded-lg text-sm focus:ring-1 focus:ring-white/10 focus:border-[#555555] bg-[#0A0A0A]"
                    >
                      <option value="pending">{t('homeworkManagement.filter.pendingReview')}</option>
                      <option value="graded">{t('homeworkManagement.filter.graded')}</option>
                      <option value="all">{t('homeworkManagement.filter.allSubmissions')}</option>
                    </select>
                    <span className="text-sm text-[#666666] ml-2">
                      {filteredSubmissions.length} {t('homeworkManagement.assignment.submissions')}
                    </span>
                  </div>
                </div>

                {/* Submissions List */}
                <div className="divide-y divide-[#1F1F1F] max-h-[calc(100dvh-400px)] overflow-y-auto">
                  {isLoadingSubmissions ? (
                    <div className="p-8 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-[#FAFAFA] animate-spin" />
                    </div>
                  ) : filteredSubmissions.length === 0 ? (
                    <div className="p-8 text-center">
                      <Users className="w-12 h-12 text-[#A0A0A0] mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-[#A0A0A0]">
                        {submissionFilter === 'pending'
                          ? t('homeworkManagement.submissions.empty.pendingTitle')
                          : submissionFilter === 'graded'
                          ? t('homeworkManagement.submissions.empty.gradedTitle')
                          : t('homeworkManagement.submissions.empty.allTitle')}
                      </h3>
                      <p className="text-[#666666] mt-1">
                        {submissionFilter === 'pending'
                          ? t('homeworkManagement.submissions.empty.pendingDescription')
                          : submissionFilter === 'graded'
                          ? t('homeworkManagement.submissions.empty.gradedDescription')
                          : t('homeworkManagement.submissions.empty.allDescription')}
                      </p>
                    </div>
                  ) : (
                    filteredSubmissions.map((submission) => {
                      const studentName =
                        submission.student?.full_name ||
                        submission.student?.email ||
                        t('homeworkManagement.submissions.unknownStudent');
                      const submittedDate = formatDate(submission.submitted_at);
                      const textPreview = submission.text_response
                        ? submission.text_response.length > 120
                          ? `${submission.text_response.slice(0, 120)}...`
                          : submission.text_response
                        : t('homeworkManagement.submissions.noTextResponse');

                      return (
                        <div
                          key={submission.id}
                          className="p-4 hover:bg-[#0A0A0A] transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            {/* Avatar */}
                            {submission.student?.avatar_url ? (
                              <img
                                src={submission.student.avatar_url}
                                alt={studentName}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-[#1F1F1F] flex items-center justify-center flex-shrink-0">
                                <span className="text-[#FAFAFA] font-medium text-sm">
                                  {studentName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-[#FAFAFA]">
                                  {studentName}
                                </h4>
                                {submission.status === 'graded' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#22C55E]/10 text-[#22C55E] rounded text-xs font-medium">
                                    <CheckCircle className="w-3 h-3" />
                                    {t('homeworkManagement.status.graded')}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-[#666666] mt-0.5">
                                {t('homeworkManagement.submissions.submitted')} {submittedDate}
                              </p>
                              <p className="text-sm text-[#A0A0A0] mt-2 line-clamp-2">
                                {textPreview}
                              </p>
                            </div>

                            {/* Action */}
                            <div className="flex-shrink-0">
                              {submission.status === 'pending' ? (
                                <button
                                  onClick={() => handleGradeClick(submission)}
                                  className="px-4 py-2 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] rounded-lg hover:bg-[#E0E0E0] transition-colors font-medium text-sm"
                                >
                                  {t('homeworkManagement.buttons.grade')}
                                </button>
                              ) : (
                                <div className="text-right">
                                  <div className="flex items-center gap-1 text-[#22C55E] font-semibold">
                                    <Award className="w-4 h-4" />
                                    {submission.points_awarded}/{selectedAssignment.max_points}
                                  </div>
                                  <button
                                    onClick={() => handleGradeClick(submission)}
                                    className="text-xs text-[#666666] hover:text-[#FAFAFA] mt-1"
                                  >
                                    {t('homeworkManagement.buttons.editGrade')}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] p-12 text-center">
                <ClipboardList className="w-16 h-16 text-[#A0A0A0] mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-[#A0A0A0]">
                  {t('homeworkManagement.selectAssignment.title')}
                </h3>
                <p className="text-[#666666] mt-2 max-w-md mx-auto">
                  {t('homeworkManagement.selectAssignment.description')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Assignment Edit Modal */}
      <AssignmentEditModal
        assignment={editingAssignment}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingAssignment(null);
        }}
        onSave={handleSaveAssignment}
        onDelete={editingAssignment ? handleDeleteAssignment : undefined}
      />

      {/* Grading Modal */}
      {gradingSubmission && selectedAssignment && (
        <GradingModal
          submission={gradingSubmission}
          maxPoints={selectedAssignment.max_points}
          isOpen={isGradingModalOpen}
          onClose={() => {
            setIsGradingModalOpen(false);
            setGradingSubmission(null);
          }}
          onGrade={handleGrade}
        />
      )}
    </div>
  );
};

export default HomeworkManagement;
