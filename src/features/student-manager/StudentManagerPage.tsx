import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import {
  Users,
  Award,
  Search,
  Loader2,
  X,
  Trophy,
  FileText,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Inbox,
  MessageSquare,
  Send,
  Filter,
  UserMinus,
  AlertTriangle,
  Ticket,
  Tag,
  CreditCard,
  Calendar,
  Info,
} from 'lucide-react';
import { getAllCreatorStudents, addBonusPoints, removeStudentFromCommunity, getCreatorCommunities, StudentWithCommunities, PaginatedStudents, CommunityInfo, MembershipPaymentInfo } from './studentManagerService';
import { getPendingApplicationsCount } from '../community/communityService';
import { ApplicationsTab } from './ApplicationsTab';
import {
  getOrCreateCreatorConversation,
  getMessages,
  sendMessage,
  markConversationAsRead,
} from '../direct-messages/dmService';
import UserProfilePopup from '../community/UserProfilePopup';
import type { MessageWithSender, DbDirectConversation } from '../direct-messages/dmTypes';

type TabType = 'students' | 'applications';

interface StudentManagerPageProps {
  creatorId: string;
}

const PAGE_SIZE = 10;

const StudentManagerPage: React.FC<StudentManagerPageProps> = ({ creatorId }) => {
  const { t } = useTranslation();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('students');
  const [applicationsCount, setApplicationsCount] = useState(0);

  // State
  const [paginatedData, setPaginatedData] = useState<PaginatedStudents | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Community filter state
  const [communities, setCommunities] = useState<CommunityInfo[]>([]);
  const [selectedCommunityFilter, setSelectedCommunityFilter] = useState<string>('');

  // Bonus points modal state
  const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithCommunities | null>(null);
  const [viewingStudentId, setViewingStudentId] = useState<string | null>(null);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>('');
  const [bonusPoints, setBonusPoints] = useState(5);
  const [bonusReason, setBonusReason] = useState('');
  const [isAwarding, setIsAwarding] = useState(false);

  // Message modal state
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageStudent, setMessageStudent] = useState<StudentWithCommunities | null>(null);
  const [messageCommunityId, setMessageCommunityId] = useState<string>('');
  const [conversation, setConversation] = useState<DbDirectConversation | null>(null);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [messageContent, setMessageContent] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Remove student modal state
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [removeStudent, setRemoveStudent] = useState<StudentWithCommunities | null>(null);
  const [removeCommunityId, setRemoveCommunityId] = useState<string>('');
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // Payment detail modal state
  const [paymentDetailOpen, setPaymentDetailOpen] = useState(false);
  const [paymentDetailStudent, setPaymentDetailStudent] = useState<StudentWithCommunities | null>(null);
  const [paymentDetailInfo, setPaymentDetailInfo] = useState<MembershipPaymentInfo | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to page 1 on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load communities for filter dropdown
  useEffect(() => {
    const loadCommunities = async () => {
      const data = await getCreatorCommunities(creatorId);
      setCommunities(data);
    };
    loadCommunities();
  }, [creatorId]);

  // Load students
  const loadStudents = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAllCreatorStudents(creatorId, currentPage, PAGE_SIZE, debouncedSearch, selectedCommunityFilter);
      setPaginatedData(data);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setIsLoading(false);
    }
  }, [creatorId, currentPage, debouncedSearch, selectedCommunityFilter]);

  // Initial load and reload on page/search/filter change
  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // Load applications count
  const loadApplicationsCount = useCallback(async () => {
    try {
      const count = await getPendingApplicationsCount(creatorId);
      setApplicationsCount(count);
    } catch (error) {
      console.error('Error loading applications count:', error);
    }
  }, [creatorId]);

  useEffect(() => {
    loadApplicationsCount();
  }, [loadApplicationsCount]);

  // Open bonus modal for a student
  const handleBonusClick = (student: StudentWithCommunities) => {
    setSelectedStudent(student);
    // Default to first community if student is in multiple
    setSelectedCommunityId(student.communities[0]?.id || '');
    setBonusPoints(5);
    setBonusReason('');
    setIsBonusModalOpen(true);
  };

  // Award bonus points
  const handleAwardBonus = async () => {
    if (!selectedStudent || !selectedCommunityId) return;

    setIsAwarding(true);
    try {
      const success = await addBonusPoints(
        selectedStudent.profile.id,
        selectedCommunityId,
        bonusPoints,
        bonusReason
      );

      if (success) {
        // Refresh the student list to show updated points
        await loadStudents();
        setIsBonusModalOpen(false);
        setSelectedStudent(null);
      }
    } catch (error) {
      console.error('Error awarding bonus points:', error);
    } finally {
      setIsAwarding(false);
    }
  };

  // Close modal
  const handleCloseModal = () => {
    if (!isAwarding) {
      setIsBonusModalOpen(false);
      setSelectedStudent(null);
    }
  };

  // Open message modal for a student
  const handleMessageClick = async (student: StudentWithCommunities) => {
    setMessageStudent(student);
    // Default to first community
    const communityId = student.communities[0]?.id || '';
    setMessageCommunityId(communityId);
    setIsMessageModalOpen(true);
    setMessages([]);
    setMessageContent('');

    if (communityId) {
      await loadConversation(communityId, student.profile.id);
    }
  };

  // Load or create conversation and messages
  const loadConversation = async (communityId: string, studentProfileId: string) => {
    setIsLoadingMessages(true);
    try {
      const conv = await getOrCreateCreatorConversation(communityId, creatorId, studentProfileId);
      setConversation(conv);

      if (conv) {
        const msgs = await getMessages(conv.id, 50, 0);
        setMessages(msgs);
        // Mark as read
        await markConversationAsRead(conv.id, creatorId);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Handle community change in message modal
  const handleMessageCommunityChange = async (communityId: string) => {
    setMessageCommunityId(communityId);
    if (messageStudent) {
      await loadConversation(communityId, messageStudent.profile.id);
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!conversation || !messageContent.trim()) return;

    setIsSendingMessage(true);
    try {
      const newMessage = await sendMessage(conversation.id, creatorId, messageContent.trim());
      if (newMessage) {
        setMessages(prev => [...prev, newMessage]);
        setMessageContent('');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Close message modal
  const handleCloseMessageModal = () => {
    if (!isSendingMessage) {
      setIsMessageModalOpen(false);
      setMessageStudent(null);
      setConversation(null);
      setMessages([]);
      setMessageContent('');
    }
  };

  // Open remove modal for a student
  const handleRemoveClick = (student: StudentWithCommunities) => {
    setRemoveStudent(student);
    setRemoveCommunityId(student.communities[0]?.id || '');
    setRemoveError(null);
    setIsRemoveModalOpen(true);
  };

  // Confirm remove student
  const handleConfirmRemove = async () => {
    if (!removeStudent || !removeCommunityId) return;

    setIsRemoving(true);
    setRemoveError(null);
    try {
      const result = await removeStudentFromCommunity(removeCommunityId, removeStudent.profile.id);

      if (result.success) {
        await loadStudents();
        setIsRemoveModalOpen(false);
        setRemoveStudent(null);
      } else {
        setRemoveError(result.error || t('studentManager.removeModal.errorGeneric'));
      }
    } catch (error) {
      console.error('Error removing student:', error);
      setRemoveError(t('studentManager.removeModal.errorGeneric'));
    } finally {
      setIsRemoving(false);
    }
  };

  // Close remove modal
  const handleCloseRemoveModal = () => {
    if (!isRemoving) {
      setIsRemoveModalOpen(false);
      setRemoveStudent(null);
      setRemoveError(null);
    }
  };

  // Pagination handlers
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (paginatedData && currentPage < paginatedData.totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const students = paginatedData?.students || [];
  const totalCount = paginatedData?.totalCount || 0;
  const totalPages = paginatedData?.totalPages || 0;

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <div className="bg-[#0A0A0A] border-b border-[#1F1F1F]">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#1F1F1F] rounded-xl">
              <Users className="w-7 h-7 text-[#FAFAFA]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#FAFAFA]">{t('studentManager.page.title')}</h1>
              <p className="text-[#A0A0A0]">
                {t('studentManager.page.description')}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex gap-1 border-b border-[#1F1F1F] -mb-px">
            <button
              onClick={() => setActiveTab('students')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'students'
                  ? 'border-white text-[#FAFAFA]'
                  : 'border-transparent text-[#666666] hover:text-[#A0A0A0]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                {t('studentManager.tabs.students')}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('applications')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'applications'
                  ? 'border-white text-[#FAFAFA]'
                  : 'border-transparent text-[#666666] hover:text-[#A0A0A0]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4" />
                {t('studentManager.tabs.applications')}
                {applicationsCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-semibold bg-[#EAB308]/10 text-[#EAB308] rounded-full">
                    {applicationsCount}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Applications Tab */}
        {activeTab === 'applications' && (
          <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] overflow-hidden">
            <ApplicationsTab
              creatorId={creatorId}
              onApplicationsChange={loadApplicationsCount}
            />
          </div>
        )}

        {/* Students Tab - Search Bar */}
        {activeTab === 'students' && (
          <>
        {/* Search Bar and Community Filter */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#666666]" />
            <input
              type="text"
              placeholder={t('studentManager.search.placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
            />
          </div>

          {/* Community Filter */}
          {communities.length > 1 && (
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#666666] pointer-events-none" />
              <select
                value={selectedCommunityFilter}
                onChange={(e) => {
                  setSelectedCommunityFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 pr-8 py-2.5 border border-[#1F1F1F] rounded-lg focus:outline-none focus:border-[#1F1F1F] appearance-none bg-[#0A0A0A] cursor-pointer min-w-[200px]"
              >
                <option value="">{t('studentManager.filter.allCommunities')}</option>
                {communities.map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666666] rotate-90 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Students Table */}
        <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-12 h-12 text-[#FAFAFA] animate-spin mx-auto" />
            </div>
          ) : students.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-[#A0A0A0] mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-[#A0A0A0]">
                {debouncedSearch ? t('studentManager.empty.noResults.title') : t('studentManager.empty.noStudents.title')}
              </h3>
              <p className="text-[#666666] mt-2">
                {debouncedSearch
                  ? t('studentManager.empty.noResults.description')
                  : t('studentManager.empty.noStudents.description')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0A0A0A] border-b border-[#1F1F1F]">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#A0A0A0]">
                      {t('studentManager.table.headers.student')}
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#A0A0A0]">
                      <div className="flex items-center gap-1">
                        <Trophy className="w-4 h-4" />
                        {t('studentManager.table.headers.points')}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#A0A0A0]">
                      {t('studentManager.table.headers.level')}
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#A0A0A0]">
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {t('studentManager.table.headers.submissions')}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-[#A0A0A0]">
                      {t('studentManager.table.headers.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F1F1F]">
                  {students.map((student) => {
                    const studentName = student.profile.full_name || student.profile.email;
                    const totalPoints = student.points?.total_points || 0;
                    const level = student.points?.level || 1;

                    return (
                      <tr key={student.profile.id} className="hover:bg-[#0A0A0A] transition-colors">
                        {/* Student Info with Community Labels */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {student.profile.avatar_url ? (
                              <img
                                src={student.profile.avatar_url}
                                alt={studentName}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-[#1F1F1F] flex items-center justify-center flex-shrink-0">
                                <span className="text-[#FAFAFA] font-medium">
                                  {studentName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-[#FAFAFA] cursor-pointer hover:underline" onClick={() => setViewingStudentId(student.profile.id)}>{studentName}</p>
                              {student.profile.full_name && (
                                <p className="text-sm text-[#666666]">{student.profile.email}</p>
                              )}
                              {/* Community Labels with Plan & Promo Info */}
                              <div className="flex flex-col gap-1.5 mt-1">
                                {student.communities.map((community) => {
                                  const payment = student.membershipPayments.find(
                                    (p) => p.communityId === community.id
                                  );
                                  const planType = payment?.planType ?? 'free';

                                  const planBadgeStyles: Record<string, string> = {
                                    one_time: 'bg-[#22C55E]/10 text-[#22C55E]',
                                    monthly: 'bg-[#1F1F1F] text-[#A0A0A0]',
                                    free: 'bg-[#1F1F1F] text-[#666666]',
                                    canceled: 'bg-[#EF4444]/10 text-[#EF4444]',
                                  };
                                  const planLabel: Record<string, string> = {
                                    one_time: t('studentManager.plan.oneTime'),
                                    monthly: t('studentManager.plan.monthly'),
                                    free: t('studentManager.plan.free'),
                                    canceled: t('studentManager.plan.canceled'),
                                  };

                                  const isExpired = payment?.expiresAt && new Date(payment.expiresAt) < new Date();

                                  return (
                                    <div key={community.id} className="flex flex-wrap items-center gap-1">
                                      <span
                                        className="inline-flex items-center px-2 py-0.5 bg-[#1F1F1F] text-[#A0A0A0] rounded text-xs font-medium truncate max-w-[150px]"
                                        title={community.name}
                                      >
                                        {community.name}
                                      </span>
                                      <button
                                        onClick={() => {
                                          setPaymentDetailStudent(student);
                                          setPaymentDetailInfo(payment ?? null);
                                          setPaymentDetailOpen(true);
                                        }}
                                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer hover:opacity-80 transition-opacity ${planBadgeStyles[planType]}`}
                                      >
                                        {planLabel[planType]}
                                      </button>
                                      {planType === 'monthly' && payment?.expiresAt && (
                                        <span className={`text-[10px] ${isExpired ? 'text-[#EF4444] font-medium' : 'text-[#666666]'}`}>
                                          {isExpired
                                            ? t('studentManager.plan.expired')
                                            : t('studentManager.plan.expiresAt', {
                                                date: new Date(payment.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                                              })}
                                        </span>
                                      )}
                                      {payment?.discountCode && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#151515] text-[#FAFAFA] rounded text-[10px] font-medium">
                                          <Ticket className="w-2.5 h-2.5" />
                                          {t('studentManager.plan.usedCode', { code: payment.discountCode, percent: payment.discountPercent })}
                                        </span>
                                      )}
                                      {payment?.assignedCode && !payment?.discountCode && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#EAB308]/10 text-[#EAB308] rounded text-[10px] font-medium">
                                          <Tag className="w-2.5 h-2.5" />
                                          {t('studentManager.plan.assignedCode', { code: payment.assignedCode, percent: payment.assignedCodePercent })}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Points */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <Award className="w-4 h-4 text-[#EAB308]" />
                            <span className="font-semibold text-[#FAFAFA]">{totalPoints}</span>
                          </div>
                        </td>

                        {/* Level */}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 bg-[#1F1F1F] text-[#A0A0A0] rounded-full text-sm font-medium">
                            {t('studentManager.table.levelBadge', { level })}
                          </span>
                        </td>

                        {/* Submissions */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-[#FAFAFA]">
                              {student.gradedCount}/{student.submissionCount}
                            </span>
                            {student.submissionCount > 0 && (
                              <span className="text-[#666666] text-sm">
                                {t('studentManager.table.gradedPercentage', { percent: Math.round((student.gradedCount / student.submissionCount) * 100) })}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleMessageClick(student)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1F1F1F] text-[#A0A0A0] hover:bg-[#151515] rounded-lg font-medium text-sm transition-colors"
                            >
                              <MessageSquare className="w-4 h-4" />
                              {t('studentManager.actions.message')}
                            </button>
                            <button
                              onClick={() => handleBonusClick(student)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#EAB308]/10 text-[#EAB308] hover:bg-[#EAB308]/20 rounded-lg font-medium text-sm transition-colors"
                            >
                              <Award className="w-4 h-4" />
                              {t('studentManager.actions.bonus')}
                            </button>
                            <button
                              onClick={() => handleRemoveClick(student)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg font-medium text-sm transition-colors"
                              title={t('studentManager.actions.remove')}
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination & Summary */}
        {totalCount > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-[#666666]">
              {t('studentManager.summary.showing', {
                filtered: students.length,
                total: totalCount,
              })}
              {totalPages > 1 && (
                <span className="ml-1">
                  ({t('studentManager.pagination.page', { current: currentPage, total: totalPages })})
                </span>
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-3 py-1.5 border border-[#1F1F1F] rounded-lg text-sm font-medium text-[#A0A0A0] hover:bg-[#0A0A0A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {t('studentManager.pagination.prev')}
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // Show pages around current page
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === pageNum
                            ? 'bg-[var(--fc-text,white)] text-[var(--fc-surface,black)]'
                            : 'text-[#A0A0A0] hover:bg-[#1F1F1F]'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 border border-[#1F1F1F] rounded-lg text-sm font-medium text-[#A0A0A0] hover:bg-[#0A0A0A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t('studentManager.pagination.next')}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
          </>
        )}
      </div>

      {/* Bonus Points Modal */}
      {isBonusModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#0A0A0A] rounded-xl w-full max-w-md mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#1F1F1F]">
              <h3 className="text-lg font-semibold text-[#FAFAFA]">{t('studentManager.bonusModal.title')}</h3>
              <button
                onClick={handleCloseModal}
                disabled={isAwarding}
                className="p-1 text-[#666666] hover:text-[#A0A0A0] rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4">
              {/* Student Info */}
              <div className="flex items-center gap-3 mb-6 p-3 bg-[#0A0A0A] rounded-lg">
                {selectedStudent.profile.avatar_url ? (
                  <img
                    src={selectedStudent.profile.avatar_url}
                    alt={selectedStudent.profile.full_name || ''}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#1F1F1F] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#FAFAFA] font-medium text-lg">
                      {(selectedStudent.profile.full_name || selectedStudent.profile.email)
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-medium text-[#FAFAFA]">
                    {selectedStudent.profile.full_name || selectedStudent.profile.email}
                  </p>
                  <p className="text-sm text-[#666666]">
                    {t('studentManager.bonusModal.currentPoints', { points: selectedStudent.points?.total_points || 0 })}
                  </p>
                </div>
              </div>

              {/* Community Selector (if student is in multiple communities) */}
              {selectedStudent.communities.length > 1 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-[#A0A0A0] mb-2">
                    {t('studentManager.bonusModal.selectCommunity')}
                  </label>
                  <select
                    value={selectedCommunityId}
                    onChange={(e) => setSelectedCommunityId(e.target.value)}
                    className="w-full px-3 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
                  >
                    {selectedStudent.communities.map((community) => (
                      <option key={community.id} value={community.id}>
                        {community.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Points Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#A0A0A0] mb-2">
                  {t('studentManager.bonusModal.pointsLabel')}
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={bonusPoints}
                  onChange={(e) => setBonusPoints(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full px-3 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
                />
              </div>

              {/* Reason Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-[#A0A0A0] mb-2">
                  {t('studentManager.bonusModal.reasonLabel')}
                </label>
                <input
                  type="text"
                  placeholder={t('studentManager.bonusModal.reasonPlaceholder')}
                  value={bonusReason}
                  onChange={(e) => setBonusReason(e.target.value)}
                  className="w-full px-3 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
                />
              </div>

              {/* Preview */}
              <div className="flex items-center gap-2 p-3 bg-[#EAB308]/10 border border-[#EAB308]/20 rounded-lg mb-4">
                <CheckCircle className="w-5 h-5 text-[#EAB308] flex-shrink-0" />
                <p className="text-sm text-[#FAFAFA]">
                  <Trans
                    i18nKey="studentManager.bonusModal.preview"
                    values={{ points: bonusPoints, name: selectedStudent.profile.full_name || selectedStudent.profile.email }}
                    components={{ strong: <strong /> }}
                  />
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-[#1F1F1F]">
              <button
                onClick={handleCloseModal}
                disabled={isAwarding}
                className="px-4 py-2 text-[#A0A0A0] hover:bg-[#1F1F1F] rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {t('studentManager.bonusModal.cancel')}
              </button>
              <button
                onClick={handleAwardBonus}
                disabled={isAwarding}
                className="flex items-center gap-2 px-4 py-2 bg-[#EAB308] text-white hover:bg-[#EAB308] rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isAwarding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('studentManager.bonusModal.submitting')}
                  </>
                ) : (
                  <>
                    <Award className="w-4 h-4" />
                    {t('studentManager.bonusModal.submit')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Modal */}
      {isMessageModalOpen && messageStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#0A0A0A] rounded-xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#1F1F1F] shrink-0">
              <div className="flex items-center gap-3">
                {messageStudent.profile.avatar_url ? (
                  <img
                    src={messageStudent.profile.avatar_url}
                    alt={messageStudent.profile.full_name || ''}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#1F1F1F] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#FAFAFA] font-medium">
                      {(messageStudent.profile.full_name || messageStudent.profile.email)
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-[#FAFAFA]">
                    {messageStudent.profile.full_name || messageStudent.profile.email}
                  </h3>
                  <p className="text-sm text-[#666666]">{t('studentManager.messageModal.directMessage')}</p>
                </div>
              </div>
              <button
                onClick={handleCloseMessageModal}
                disabled={isSendingMessage}
                className="p-1 text-[#666666] hover:text-[#A0A0A0] rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Community Selector (if student is in multiple communities) */}
            {messageStudent.communities.length > 1 && (
              <div className="px-4 py-3 border-b border-[#1F1F1F] shrink-0">
                <select
                  value={messageCommunityId}
                  onChange={(e) => handleMessageCommunityChange(e.target.value)}
                  className="w-full px-3 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555] text-sm"
                >
                  {messageStudent.communities.map((community) => (
                    <option key={community.id} value={community.id}>
                      {community.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 text-[#FAFAFA] animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <MessageSquare className="w-12 h-12 text-[#A0A0A0] mb-3" />
                  <p className="text-[#666666]">{t('studentManager.messageModal.noMessages')}</p>
                  <p className="text-sm text-[#666666]">{t('studentManager.messageModal.startConversation')}</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isOwn = message.sender_profile_id === creatorId;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                          isOwn
                            ? 'bg-[#FAFAFA] text-black rounded-br-md'
                            : 'bg-[#151515] text-[#A0A0A0] rounded-bl-md'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        <p
                          className={`text-[10px] mt-1 ${
                            isOwn ? 'text-[#A0A0A0]' : 'text-[#666666]'
                          }`}
                        >
                          {new Date(message.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Message Input */}
            <div className="border-t border-[#1F1F1F] p-4 shrink-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={t('studentManager.messageModal.placeholder')}
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={!conversation || isSendingMessage}
                  className="flex-1 px-4 py-2 border border-[#1F1F1F] rounded-full focus:ring-1 focus:ring-white/10 focus:border-[#555555] disabled:opacity-50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!conversation || !messageContent.trim() || isSendingMessage}
                  className="p-2.5 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] rounded-full hover:bg-[#E0E0E0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSendingMessage ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Remove Student Modal */}
      {isRemoveModalOpen && removeStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#0A0A0A] rounded-xl w-full max-w-md mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#1F1F1F]">
              <div className="flex items-center gap-2 text-[#EF4444]">
                <UserMinus className="w-5 h-5" />
                <h3 className="text-lg font-semibold">{t('studentManager.removeModal.title')}</h3>
              </div>
              <button
                onClick={handleCloseRemoveModal}
                disabled={isRemoving}
                className="p-1 text-[#666666] hover:text-[#A0A0A0] rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* Student Info */}
              <div className="flex items-center gap-3 p-3 bg-[#0A0A0A] rounded-lg">
                {removeStudent.profile.avatar_url ? (
                  <img
                    src={removeStudent.profile.avatar_url}
                    alt={removeStudent.profile.full_name || ''}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#1F1F1F] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#FAFAFA] font-medium text-lg">
                      {(removeStudent.profile.full_name || removeStudent.profile.email)
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-medium text-[#FAFAFA]">
                    {removeStudent.profile.full_name || removeStudent.profile.email}
                  </p>
                  <p className="text-sm text-[#666666]">{removeStudent.profile.email}</p>
                </div>
              </div>

              {/* Community Selector (if student is in multiple communities) */}
              {removeStudent.communities.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-[#A0A0A0] mb-2">
                    {t('studentManager.removeModal.selectCommunity')}
                  </label>
                  <select
                    value={removeCommunityId}
                    onChange={(e) => setRemoveCommunityId(e.target.value)}
                    className="w-full px-3 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-[#EF4444]/20 focus:border-[#555555]"
                  >
                    {removeStudent.communities.map((community) => (
                      <option key={community.id} value={community.id}>
                        {community.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Warning */}
              <div className="bg-[#EAB308]/10 border border-[#EAB308]/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-[#EAB308] flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-[#FAFAFA] font-medium mb-1">
                      {t('studentManager.removeModal.warningTitle')}
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-[#EAB308]">
                      <li>{t('studentManager.removeModal.loseAccess')}</li>
                      <li>{t('studentManager.removeModal.subscriptionCanceled')}</li>
                      <li>{t('studentManager.removeModal.cannotUndo')}</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Error message */}
              {removeError && (
                <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg p-3">
                  <p className="text-[#EF4444] text-sm">{removeError}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-[#1F1F1F]">
              <button
                onClick={handleCloseRemoveModal}
                disabled={isRemoving}
                className="px-4 py-2 text-[#A0A0A0] hover:bg-[#1F1F1F] rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {t('studentManager.removeModal.cancel')}
              </button>
              <button
                onClick={handleConfirmRemove}
                disabled={isRemoving || !removeCommunityId}
                className="flex items-center gap-2 px-4 py-2 bg-[#EF4444] text-white hover:bg-[#EF4444]/80 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isRemoving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('studentManager.removeModal.removing')}
                  </>
                ) : (
                  <>
                    <UserMinus className="w-4 h-4" />
                    {t('studentManager.removeModal.confirm')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Payment Detail Modal */}
      {paymentDetailOpen && paymentDetailStudent && paymentDetailInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#0A0A0A] rounded-xl w-full max-w-md mx-4">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#1F1F1F]">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#FAFAFA]" />
                <h3 className="text-lg font-semibold text-[#FAFAFA]">{t('studentManager.paymentDetail.title')}</h3>
              </div>
              <button
                onClick={() => setPaymentDetailOpen(false)}
                className="p-1 text-[#666666] hover:text-[#A0A0A0] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
              {/* Student Info */}
              <div className="flex items-center gap-3 p-3 bg-[#0A0A0A] rounded-lg">
                {paymentDetailStudent.profile.avatar_url ? (
                  <img
                    src={paymentDetailStudent.profile.avatar_url}
                    alt={paymentDetailStudent.profile.full_name || ''}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#1F1F1F] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#FAFAFA] font-medium">
                      {(paymentDetailStudent.profile.full_name || paymentDetailStudent.profile.email)
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-medium text-[#FAFAFA]">
                    {paymentDetailStudent.profile.full_name || paymentDetailStudent.profile.email}
                  </p>
                  <p className="text-sm text-[#666666]">{paymentDetailInfo.communityName}</p>
                </div>
              </div>

              {/* Payment Details Grid */}
              <div className="space-y-3">
                {/* Plan Type */}
                <div className="flex items-center justify-between py-2 border-b border-[#1F1F1F]">
                  <span className="text-sm text-[#666666]">{t('studentManager.paymentDetail.plan')}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                    {
                      one_time: 'bg-[#22C55E]/10 text-[#22C55E]',
                      monthly: 'bg-[#1F1F1F] text-[#A0A0A0]',
                      free: 'bg-[#1F1F1F] text-[#666666]',
                      canceled: 'bg-[#EF4444]/10 text-[#EF4444]',
                    }[paymentDetailInfo.planType]
                  }`}>
                    {({
                      one_time: t('studentManager.plan.oneTime'),
                      monthly: t('studentManager.plan.monthly'),
                      free: t('studentManager.plan.free'),
                      canceled: t('studentManager.plan.canceled'),
                    } as Record<string, string>)[paymentDetailInfo.planType]}
                  </span>
                </div>

                {/* Amount Charged */}
                <div className="flex items-center justify-between py-2 border-b border-[#1F1F1F]">
                  <span className="text-sm text-[#666666]">{t('studentManager.paymentDetail.amountCharged')}</span>
                  <span className="text-sm font-semibold text-[#FAFAFA]">
                    {paymentDetailInfo.amountCents != null
                      ? `€${(paymentDetailInfo.amountCents / 100).toFixed(2)}`
                      : paymentDetailInfo.planType === 'free'
                        ? '€0.00'
                        : '—'}
                  </span>
                </div>

                {/* Payment Date */}
                {paymentDetailInfo.paidAt && (
                  <div className="flex items-center justify-between py-2 border-b border-[#1F1F1F]">
                    <span className="text-sm text-[#666666]">{t('studentManager.paymentDetail.paidAt')}</span>
                    <span className="text-sm text-[#FAFAFA]">
                      {new Date(paymentDetailInfo.paidAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                )}

                {/* Expiry (monthly only) */}
                {paymentDetailInfo.planType === 'monthly' && paymentDetailInfo.expiresAt && (
                  <div className="flex items-center justify-between py-2 border-b border-[#1F1F1F]">
                    <span className="text-sm text-[#666666]">{t('studentManager.paymentDetail.expiresAt')}</span>
                    <span className={`text-sm font-medium ${
                      new Date(paymentDetailInfo.expiresAt) < new Date() ? 'text-[#EF4444]' : 'text-[#FAFAFA]'
                    }`}>
                      {new Date(paymentDetailInfo.expiresAt) < new Date()
                        ? t('studentManager.plan.expired')
                        : new Date(paymentDetailInfo.expiresAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                    </span>
                  </div>
                )}

                {/* Discount Code Used */}
                {paymentDetailInfo.discountCode && (
                  <div className="flex items-center justify-between py-2 border-b border-[#1F1F1F]">
                    <span className="text-sm text-[#666666]">{t('studentManager.paymentDetail.discountUsed')}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#151515] text-[#A0A0A0] rounded text-xs font-semibold">
                      <Ticket className="w-3 h-3" />
                      {paymentDetailInfo.discountCode} (-{paymentDetailInfo.discountPercent}%)
                    </span>
                  </div>
                )}

                {/* Assigned Code (not yet used) */}
                {paymentDetailInfo.assignedCode && !paymentDetailInfo.discountCode && (
                  <div className="flex items-center justify-between py-2 border-b border-[#1F1F1F]">
                    <span className="text-sm text-[#666666]">{t('studentManager.paymentDetail.assignedCode')}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#EAB308]/10 text-[#EAB308] rounded text-xs font-semibold">
                      <Tag className="w-3 h-3" />
                      {paymentDetailInfo.assignedCode} (-{paymentDetailInfo.assignedCodePercent}%)
                    </span>
                  </div>
                )}
              </div>

              {/* No payment data info */}
              {paymentDetailInfo.planType === 'free' && !paymentDetailInfo.discountCode && !paymentDetailInfo.assignedCode && (
                <div className="flex items-start gap-2 p-3 bg-[#0A0A0A] rounded-lg">
                  <Info className="w-4 h-4 text-[#666666] mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-[#666666]">{t('studentManager.paymentDetail.freeNote')}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end p-4 border-t border-[#1F1F1F]">
              <button
                onClick={() => setPaymentDetailOpen(false)}
                className="px-4 py-2 text-[#A0A0A0] hover:bg-[#1F1F1F] rounded-lg font-medium transition-colors"
              >
                {t('studentManager.paymentDetail.close')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Student Profile Popup */}
      {viewingStudentId && (
        <UserProfilePopup
          profileId={viewingStudentId}
          isOpen={true}
          onClose={() => setViewingStudentId(null)}
        />
      )}
    </div>
  );
};

export default StudentManagerPage;
