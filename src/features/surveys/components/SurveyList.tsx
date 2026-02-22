// =============================================================================
// SURVEY LIST
// Creator dashboard component for managing surveys
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  FileText,
  Eye,
  EyeOff,
  Users,
  BarChart2,
  Edit,
  Trash2,
  MoreVertical,
  BookOpen,
  Users2,
  Loader2,
  AlertCircle,
  Send,
  CheckCircle,
  Search,
} from 'lucide-react';
import type { SurveyWithDetails, SurveyFormData, SurveyAttachmentType } from '../surveyTypes';
import {
  getCreatorSurveys,
  createSurvey,
  deleteSurvey,
  updateSurvey,
  getCommunityMembersForSurvey,
  sendSurveyToMembers,
  type SurveyMemberInfo,
} from '../surveyService';
import Avatar from '../../../shared/Avatar';
import SurveyBuilder from './SurveyBuilder';
import SurveyResponses from './SurveyResponses';

// =============================================================================
// Create Survey Modal
// =============================================================================

interface CreateSurveyModalProps {
  creatorId: string;
  communityId?: string;
  onClose: () => void;
  onCreated: (survey: SurveyWithDetails) => void;
}

const CreateSurveyModal: React.FC<CreateSurveyModalProps> = ({
  creatorId,
  communityId,
  onClose,
  onCreated,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<SurveyFormData>({
    title: '',
    description: '',
    attachment_type: 'standalone',
    attached_course_id: null,
    community_id: communityId || null,
    is_required: true,
    allow_edit: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setIsSubmitting(true);
    try {
      const survey = await createSurvey(creatorId, formData);
      // Fetch full survey with details
      onCreated(survey as unknown as SurveyWithDetails);
    } catch (error) {
      console.error('Failed to create survey:', error);
      alert(t('surveys.list.createError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-xl font-semibold text-slate-900">
            {t('surveys.list.createTitle')}
          </h2>
        </div>
        <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('surveys.list.surveyTitle')} *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder={t('surveys.list.titlePlaceholder')}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('surveys.list.surveyType')}
            </label>
            <div className="space-y-2">
              {(['standalone', 'course_intake', 'community_intake'] as SurveyAttachmentType[]).map((type) => (
                <label
                  key={type}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    formData.attachment_type === type
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="attachmentType"
                    value={type}
                    checked={formData.attachment_type === type}
                    onChange={() => setFormData({ ...formData, attachment_type: type })}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <div className="flex items-center gap-2">
                    {type === 'standalone' && <FileText className="w-4 h-4 text-slate-500" />}
                    {type === 'course_intake' && <BookOpen className="w-4 h-4 text-slate-500" />}
                    {type === 'community_intake' && <Users2 className="w-4 h-4 text-slate-500" />}
                    <span className="text-sm text-slate-700">
                      {t(`surveys.attachmentTypes.${type}`)}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('surveys.list.description')}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder={t('surveys.list.descriptionPlaceholder')}
              rows={3}
            />
          </div>

        </form>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.title.trim()}
            className="px-5 py-2.5 text-sm bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('common.loading')}
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                {t('surveys.list.createButton')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Send Survey Modal
// =============================================================================

interface SendSurveyModalProps {
  survey: SurveyWithDetails;
  onClose: () => void;
  onSent: () => void;
}

const SendSurveyModal: React.FC<SendSurveyModalProps> = ({
  survey,
  onClose,
  onSent,
}) => {
  const { t } = useTranslation();
  const [members, setMembers] = useState<SurveyMemberInfo[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [result, setResult] = useState<{ sent: number; skipped: number } | null>(null);

  // Load community members
  useEffect(() => {
    const loadMembers = async () => {
      if (!survey.community_id) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await getCommunityMembersForSurvey(
          survey.community_id,
          survey.id
        );
        setMembers(data);
      } catch (error) {
        console.error('Failed to load members:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMembers();
  }, [survey.community_id, survey.id]);

  // Filter members by search query
  const filteredMembers = members.filter((m) =>
    m.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get eligible members (those who haven't responded yet)
  const eligibleMembers = filteredMembers.filter((m) => !m.hasResponse);

  // Toggle single member selection
  const toggleMember = (memberId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedIds(newSelected);
  };

  // Select all eligible members
  const selectAll = () => {
    const allEligibleIds = new Set(eligibleMembers.map((m) => m.id));
    setSelectedIds(allEligibleIds);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Send survey to selected members
  const handleSend = async () => {
    if (selectedIds.size === 0) return;

    setIsSending(true);
    try {
      const sendResult = await sendSurveyToMembers(
        survey.id,
        Array.from(selectedIds)
      );
      setResult(sendResult);
      // Call onSent after a short delay to let user see result
      setTimeout(() => {
        onSent();
      }, 2000);
    } catch (error) {
      console.error('Failed to send survey:', error);
      alert(t('surveys.send.sendError'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {t('surveys.send.title')}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {t('surveys.send.description', { survey: survey.title })}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-6">
          {/* Success state */}
          {result && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-slate-900">
                {t('surveys.send.successTitle')}
              </h3>
              <p className="text-sm text-slate-500 mt-2 text-center">
                {t('surveys.send.successMessage', {
                  sent: result.sent,
                  skipped: result.skipped,
                })}
              </p>
            </div>
          )}

          {/* Loading state */}
          {isLoading && !result && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          )}

          {/* No community error */}
          {!isLoading && !result && !survey.community_id && (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <p className="text-slate-600">
                {t('surveys.send.noCommunity')}
              </p>
            </div>
          )}

          {/* No eligible members */}
          {!isLoading && !result && survey.community_id && eligibleMembers.length === 0 && members.length > 0 && (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">
                {t('surveys.send.allResponded')}
              </p>
            </div>
          )}

          {/* No members at all */}
          {!isLoading && !result && survey.community_id && members.length === 0 && (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">
                {t('surveys.send.noMembers')}
              </p>
            </div>
          )}

          {/* Member list */}
          {!isLoading && !result && survey.community_id && eligibleMembers.length > 0 && (
            <>
              {/* Search and selection controls */}
              <div className="space-y-3 mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('surveys.send.searchPlaceholder')}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    {t('surveys.send.selectedCount', { count: selectedIds.size })}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAll}
                      className="text-sm text-indigo-600 hover:text-indigo-700"
                    >
                      {t('surveys.send.selectAll')}
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={clearSelection}
                      className="text-sm text-slate-500 hover:text-slate-600"
                    >
                      {t('surveys.send.clearSelection')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Member list */}
              <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                {filteredMembers.map((member) => (
                  <label
                    key={member.id}
                    className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 ${
                      member.hasResponse ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(member.id)}
                      onChange={() => !member.hasResponse && toggleMember(member.id)}
                      disabled={member.hasResponse}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 disabled:opacity-50"
                    />
                    <Avatar
                      src={member.avatar_url}
                      name={member.full_name}
                      size="sm"
                    />
                    <span className="flex-1 text-sm text-slate-700">
                      {member.full_name}
                    </span>
                    {member.hasResponse && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {t('surveys.send.alreadySent')}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            {result ? t('common.close') : t('common.cancel')}
          </button>
          {!result && (
            <button
              onClick={handleSend}
              disabled={isSending || selectedIds.size === 0}
              className="px-4 py-2 text-sm bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('surveys.send.sending')}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {t('surveys.send.sendButton', { count: selectedIds.size })}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Survey Card
// =============================================================================

interface SurveyCardProps {
  survey: SurveyWithDetails;
  onEdit: () => void;
  onViewResponses: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
  onSendToMembers: () => void;
}

const SurveyCard: React.FC<SurveyCardProps> = ({
  survey,
  onEdit,
  onViewResponses,
  onDelete,
  onTogglePublish,
  onSendToMembers,
}) => {
  const { t } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);

  const attachmentIcon = {
    standalone: FileText,
    course_intake: BookOpen,
    community_intake: Users2,
  }[survey.attachment_type];
  const Icon = attachmentIcon;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-slate-300 transition-all duration-200">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 bg-gradient-to-br from-indigo-100 to-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 truncate">{survey.title}</h3>
              <p className="text-sm text-slate-500">
                {t(`surveys.attachmentTypes.${survey.attachment_type}`)}
              </p>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1 w-40">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onEdit();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  {t('common.edit')}
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onTogglePublish();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  {survey.is_published ? (
                    <>
                      <EyeOff className="w-4 h-4" />
                      {t('surveys.list.unpublish')}
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      {t('surveys.list.publish')}
                    </>
                  )}
                </button>
                {/* Only show Send to Members for surveys with a community */}
                {survey.community_id && survey.is_published && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onSendToMembers();
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {t('surveys.send.menuButton')}
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('common.delete')}
                </button>
              </div>
            )}
          </div>
        </div>

        {survey.description && (
          <p className="mt-3 text-sm text-slate-600 line-clamp-2">{survey.description}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-slate-500">
            <FileText className="w-4 h-4" />
            {t('surveys.questions', { count: survey.questions?.length || 0 })}
          </span>
          <span className="flex items-center gap-1.5 text-slate-500">
            <Users className="w-4 h-4" />
            {t('surveys.responses.count', { count: survey.response_count || 0 })}
          </span>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              survey.is_published
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {survey.is_published ? t('surveys.list.published') : t('surveys.list.draft')}
          </span>
        </div>
      </div>

      <div className="border-t border-slate-100 px-5 py-3 flex justify-between bg-slate-50/50">
        <button
          onClick={onEdit}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
        >
          {t('surveys.list.editSurvey')}
        </button>
        <button
          onClick={onViewResponses}
          className="text-sm text-slate-600 hover:text-slate-800 font-medium flex items-center gap-1.5 transition-colors"
        >
          <BarChart2 className="w-4 h-4" />
          {t('surveys.list.viewResponses')}
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// Main Survey List Component
// =============================================================================

interface SurveyListProps {
  creatorId: string;
  communityId?: string;
}

const SurveyList: React.FC<SurveyListProps> = ({ creatorId, communityId }) => {
  const { t } = useTranslation();
  const [surveys, setSurveys] = useState<SurveyWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<SurveyWithDetails | null>(null);
  const [viewingResponses, setViewingResponses] = useState<string | null>(null);
  const [sendingSurvey, setSendingSurvey] = useState<SurveyWithDetails | null>(null);

  // Load surveys
  const loadSurveys = useCallback(async () => {
    try {
      const data = await getCreatorSurveys(creatorId);
      // Filter by community if specified
      const filtered = communityId
        ? data.filter((s) => s.community_id === communityId)
        : data;
      setSurveys(filtered);
    } catch (error) {
      console.error('Failed to load surveys:', error);
    } finally {
      setIsLoading(false);
    }
  }, [creatorId, communityId]);

  useEffect(() => {
    loadSurveys();
  }, [loadSurveys]);

  // Handle survey created
  const handleSurveyCreated = (survey: SurveyWithDetails) => {
    setSurveys([{ ...survey, sections: [], questions: [], response_count: 0 }, ...surveys]);
    setShowCreateModal(false);
    // Open builder for the new survey
    setEditingSurvey({ ...survey, sections: [], questions: [] } as SurveyWithDetails);
  };

  // Handle delete
  const handleDelete = async (surveyId: string) => {
    if (!confirm(t('surveys.list.deleteConfirm'))) return;
    try {
      await deleteSurvey(surveyId);
      setSurveys(surveys.filter((s) => s.id !== surveyId));
    } catch (error) {
      console.error('Failed to delete survey:', error);
      alert(t('surveys.list.deleteError'));
    }
  };

  // Handle toggle publish
  const handleTogglePublish = async (survey: SurveyWithDetails) => {
    try {
      await updateSurvey(survey.id, { is_published: !survey.is_published });
      setSurveys(
        surveys.map((s) =>
          s.id === survey.id ? { ...s, is_published: !s.is_published } : s
        )
      );
    } catch (error) {
      console.error('Failed to toggle publish:', error);
    }
  };

  // If editing a survey, show the builder
  if (editingSurvey) {
    return (
      <SurveyBuilder
        survey={editingSurvey}
        onSurveyUpdate={loadSurveys}
        onClose={() => {
          setEditingSurvey(null);
          loadSurveys();
        }}
      />
    );
  }

  // If viewing responses, show the responses view
  if (viewingResponses) {
    return (
      <SurveyResponses
        surveyId={viewingResponses}
        onClose={() => setViewingResponses(null)}
      />
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('surveys.list.title')}</h1>
          <p className="mt-1 text-slate-500">{t('surveys.list.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-sm hover:shadow-md transition-all"
        >
          <Plus className="w-5 h-5" />
          {t('surveys.list.create')}
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="mt-4 text-slate-500">{t('common.loading')}</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && surveys.length === 0 && (
        <div className="text-center py-16 bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-slate-200">
          <div className="w-20 h-20 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto">
            <FileText className="w-10 h-10 text-indigo-500" />
          </div>
          <h3 className="mt-6 text-xl font-semibold text-slate-900">
            {t('surveys.list.emptyTitle')}
          </h3>
          <p className="mt-2 text-slate-500 max-w-md mx-auto px-4">
            {t('surveys.list.emptyDescription')}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-8 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-sm hover:shadow-md transition-all"
          >
            <Plus className="w-5 h-5" />
            {t('surveys.list.createFirst')}
          </button>
        </div>
      )}

      {/* Survey Grid */}
      {!isLoading && surveys.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {surveys.map((survey) => (
            <SurveyCard
              key={survey.id}
              survey={survey}
              onEdit={() => setEditingSurvey(survey)}
              onViewResponses={() => setViewingResponses(survey.id)}
              onDelete={() => handleDelete(survey.id)}
              onTogglePublish={() => handleTogglePublish(survey)}
              onSendToMembers={() => setSendingSurvey(survey)}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateSurveyModal
          creatorId={creatorId}
          communityId={communityId}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleSurveyCreated}
        />
      )}

      {/* Send Survey Modal */}
      {sendingSurvey && (
        <SendSurveyModal
          survey={sendingSurvey}
          onClose={() => setSendingSurvey(null)}
          onSent={() => {
            setSendingSurvey(null);
            loadSurveys(); // Refresh to update response counts
          }}
        />
      )}
    </div>
  );
};

export default SurveyList;
