import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { AlertTriangle, TrendingUp, Users, ArrowUpRight, ArrowDownRight, Loader2, X, Mail, BookOpen, Calendar, Plus, MessageSquare, Sparkles, Clock, ChevronDown, ChevronUp, Building2, FileText, Download, Video, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import {
  getStudentLectureAttendance,
  AtRiskStudent,
  StudentHomeworkStatus,
  StudentLectureProgress,
} from './dashboardService';
import { useDashboardData } from './hooks/useDashboardData';
import { generateDashboardReport, gatherReportData, exportReportAsCSV, downloadCSV, GeneratedReport } from './reportService';
import TasksPanel from './TasksPanel';
import { getCreatorCommunities, createCommunity, seedDefaultChannels, joinCommunity } from '../community/communityService';
import { DbCommunity } from '../../core/supabase/database.types';
import AiResponseText from '../../components/ui/AiResponseText';
import { getOrCreateCreatorConversation, sendMessage } from '../direct-messages/dmService';

const StatCard = React.memo(({ title, value, change, icon: Icon, color, isPositive = true, showChange = true, vsLastWeekText, noPreviousDataText }: {
  title: string;
  value: string;
  change: string | null; // null = no data to compare
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  isPositive?: boolean;
  showChange?: boolean; // Whether to show the change indicator
  vsLastWeekText?: string;
  noPreviousDataText?: string;
}) => (
  <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100">
    <div className="flex justify-between items-start">
      <div className="min-w-0 flex-1">
        <p className="text-xs md:text-sm font-medium text-slate-500 truncate">{title}</p>
        <h3 className="text-xl md:text-2xl font-bold text-slate-900 mt-1">{value}</h3>
      </div>
      <div className={`p-2 rounded-lg ${color} shrink-0 ml-2`}>
        <Icon size={20} className="text-white" />
      </div>
    </div>
    <div className="mt-4 flex items-center text-sm h-5">
      {showChange && change !== null ? (
        <>
          <span className={`font-medium flex items-center ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isPositive ? <ArrowUpRight size={16} className="mr-1" /> : <ArrowDownRight size={16} className="mr-1" />}
            {change}
          </span>
          <span className="text-slate-400 ml-2">{vsLastWeekText}</span>
        </>
      ) : showChange ? (
        <span className="text-slate-400">{noPreviousDataText}</span>
      ) : (
        <span className="text-slate-400">{change}</span>
      )}
    </div>
  </div>
));

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user, profile } = useAuth();

  // Community selector state
  const [creatorCommunities, setCreatorCommunities] = useState<DbCommunity[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null); // null = all communities
  const [showCommunityDropdown, setShowCommunityDropdown] = useState(false);

  // TanStack Query - replaces manual data fetching + 4 useState hooks
  const { data: dashboardData, isLoading: loading, isError, refetch: refetchDashboard } = useDashboardData(profile?.id, selectedCommunityId);
  const stats = dashboardData?.stats ?? {
    totalStudents: 0, activeStudents: 0, completionRate: 0, atRiskCount: 0, inactiveCount: 0,
    totalCommunityMembers: 0, totalPosts: 0, homeworkTotalAssignments: 0, homeworkTotalSubmissions: 0,
    homeworkExpectedSubmissions: 0, totalStudentsChange: null, activeStudentsChange: null,
    completionRateChange: null, communityMembersChange: null,
  };
  const atRiskStudents = dashboardData?.atRiskStudents ?? [];
  const activityData = dashboardData?.activityData ?? [];
  const studentsWithMissingHomework = dashboardData?.studentsWithMissingHomework ?? [];

  const [selectedStudent, setSelectedStudent] = useState<AtRiskStudent | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isHomeworkExpanded, setIsHomeworkExpanded] = useState(false);
  const [selectedHomeworkStudent, setSelectedHomeworkStudent] = useState<StudentHomeworkStatus | null>(null);

  // Lecture attendance state
  const [showLecturesView, setShowLecturesView] = useState(false);
  const [lectureData, setLectureData] = useState<StudentLectureProgress | null>(null);
  const [isLoadingLectures, setIsLoadingLectures] = useState(false);

  // Onboarding state
  const [hasCommunity, setHasCommunity] = useState<boolean | null>(null);
  const [showCreateCommunityModal, setShowCreateCommunityModal] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState('');
  const [creatingCommunity, setCreatingCommunity] = useState(false);

  // Report generation state
  const [showReportModal, setShowReportModal] = useState(false);
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      checkCreatorCommunity();
    }
  }, [profile?.id]);

  const checkCreatorCommunity = async () => {
    if (!user?.id) return;
    // getCreatorCommunities has built-in profile lookup, accepts auth user ID
    const communities = await getCreatorCommunities(user.id);
    setCreatorCommunities(communities);
    setHasCommunity(communities.length > 0);
  };

  const handleCreateCommunity = async () => {
    if (!user?.id || !newCommunityName.trim()) return;

    setCreatingCommunity(true);
    try {
      const community = await createCommunity(user.id, newCommunityName.trim());
      if (community) {
        await seedDefaultChannels(community.id);
        await joinCommunity(user.id, community.id, 'admin');
        setHasCommunity(true);
        setShowCreateCommunityModal(false);
        setNewCommunityName('');
        showToast(t('creatorDashboard.createCommunity.successToast'));
      }
    } finally {
      setCreatingCommunity(false);
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleGenerateReport = async () => {
    if (!profile?.id) return;

    setShowReportModal(true);
    setIsGeneratingReport(true);
    setReport(null);

    try {
      const generatedReport = await generateDashboardReport(profile.id, selectedCommunityId);
      setReport(generatedReport);
    } catch (error) {
      console.error('Error generating report:', error);
      showToast(t('creatorDashboard.report.errorGenerating'));
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleDownloadCSV = async () => {
    if (!profile?.id) return;

    try {
      const data = await gatherReportData(profile.id, selectedCommunityId);
      const csv = exportReportAsCSV(data);
      const filename = `dashboard-report-${new Date().toISOString().split('T')[0]}.csv`;
      downloadCSV(csv, filename);
      showToast(t('creatorDashboard.report.downloadSuccess'));
    } catch (error) {
      console.error('Error downloading CSV:', error);
      showToast(t('creatorDashboard.report.downloadError'));
    }
  };

  const handleViewLectures = async (student: StudentHomeworkStatus) => {
    if (!student.communityIds || student.communityIds.length === 0) return;

    setIsLoadingLectures(true);
    setShowLecturesView(true);
    setLectureData(null);

    try {
      const data = await getStudentLectureAttendance(student.id, student.communityIds);
      setLectureData(data);
    } catch (error) {
      console.error('Error loading lecture attendance:', error);
      showToast(t('creatorDashboard.lectures.loadError'));
    } finally {
      setIsLoadingLectures(false);
    }
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Creator';

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <p className="text-slate-600">{t('creatorDashboard.errorLoading', 'Failed to load dashboard data')}</p>
          <button onClick={() => refetchDashboard()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm">
            {t('common.retry', 'Retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">{t('creatorDashboard.pageTitle')}</h1>
          <p className="text-sm md:text-base text-slate-500">{t('creatorDashboard.welcomeMessage', { name: displayName })}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Community Selector - only show if creator has multiple communities */}
          {creatorCommunities.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setShowCommunityDropdown(!showCommunityDropdown)}
                className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Building2 size={16} className="text-slate-500 shrink-0" />
                <span className="max-w-[120px] sm:max-w-[180px] truncate">
                  {selectedCommunityId
                    ? creatorCommunities.find(c => c.id === selectedCommunityId)?.name || t('creatorDashboard.communitySelector.allCommunities')
                    : t('creatorDashboard.communitySelector.allCommunities')
                  }
                </span>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${showCommunityDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showCommunityDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                  <button
                    onClick={() => {
                      setSelectedCommunityId(null);
                      setShowCommunityDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 ${
                      selectedCommunityId === null ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                    }`}
                  >
                    <Building2 size={14} />
                    {t('creatorDashboard.communitySelector.allCommunities')}
                    {selectedCommunityId === null && (
                      <span className="ml-auto text-indigo-500">✓</span>
                    )}
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  {creatorCommunities.map((community) => (
                    <button
                      key={community.id}
                      onClick={() => {
                        setSelectedCommunityId(community.id);
                        setShowCommunityDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 ${
                        selectedCommunityId === community.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                      }`}
                    >
                      {community.image_url ? (
                        <img src={community.image_url} alt={community.name} className="w-5 h-5 rounded-full object-cover" loading="lazy" decoding="async" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-medium">
                          {community.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="truncate">{community.name}</span>
                      {selectedCommunityId === community.id && (
                        <span className="ml-auto text-indigo-500">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={handleGenerateReport}
            className="bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <FileText size={16} className="shrink-0" />
            <span className="hidden sm:inline">{t('creatorDashboard.generateReport')}</span>
            <span className="sm:hidden">{t('creatorDashboard.generateReport')}</span>
          </button>
        </div>
      </div>

      {/* Onboarding Banner for new creators without a community */}
      {hasCommunity === false && (
        <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-start gap-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <Sparkles className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-2">{t('creatorDashboard.onboarding.title')}</h2>
              <p className="text-white/90 mb-4">
                {t('creatorDashboard.onboarding.description')}
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setShowCreateCommunityModal(true)}
                  className="bg-white text-indigo-600 px-5 py-2.5 rounded-lg font-semibold hover:bg-white/90 transition-colors flex items-center gap-2"
                >
                  <Plus size={18} />
                  {t('creatorDashboard.onboarding.createCommunityButton')}
                </button>
              </div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/10 rounded-lg p-4 flex items-start gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <MessageSquare size={20} />
              </div>
              <div>
                <h3 className="font-semibold">{t('creatorDashboard.onboarding.communityHub')}</h3>
                <p className="text-sm text-white/80">{t('creatorDashboard.onboarding.communityHubDescription')}</p>
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-4 flex items-start gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <BookOpen size={20} />
              </div>
              <div>
                <h3 className="font-semibold">{t('creatorDashboard.onboarding.courseContent')}</h3>
                <p className="text-sm text-white/80">{t('creatorDashboard.onboarding.courseContentDescription')}</p>
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-4 flex items-start gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <Calendar size={20} />
              </div>
              <div>
                <h3 className="font-semibold">{t('creatorDashboard.onboarding.eventsAndCalls')}</h3>
                <p className="text-sm text-white/80">{t('creatorDashboard.onboarding.eventsAndCallsDescription')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Community Stats - Primary for community-focused creators */}
        <StatCard
          title={t('creatorDashboard.stats.communityMembers')}
          value={stats.totalCommunityMembers.toString()}
          change={stats.communityMembersChange !== null ? `${stats.communityMembersChange >= 0 ? '+' : ''}${stats.communityMembersChange}%` : null}
          icon={Users}
          color="bg-indigo-500"
          isPositive={stats.communityMembersChange === null || stats.communityMembersChange >= 0}
          vsLastWeekText={t('creatorDashboard.stats.vsLastWeek')}
          noPreviousDataText={t('creatorDashboard.stats.noPreviousData')}
        />
        <StatCard
          title={t('creatorDashboard.stats.totalPosts')}
          value={stats.totalPosts.toString()}
          change={t('creatorDashboard.stats.communityEngagement')}
          icon={MessageSquare}
          color="bg-purple-500"
          showChange={false}
        />
        {/* Course Stats */}
        <StatCard
          title={t('creatorDashboard.stats.courseEnrollments')}
          value={stats.totalStudents.toString()}
          change={stats.totalStudentsChange !== null ? `${stats.totalStudentsChange >= 0 ? '+' : ''}${stats.totalStudentsChange}%` : null}
          icon={BookOpen}
          color="bg-emerald-500"
          isPositive={stats.totalStudentsChange === null || stats.totalStudentsChange >= 0}
          vsLastWeekText={t('creatorDashboard.stats.vsLastWeek')}
          noPreviousDataText={t('creatorDashboard.stats.noPreviousData')}
        />
        <StatCard
          title={t('creatorDashboard.stats.completionRate')}
          value={`${stats.completionRate}%`}
          change={stats.completionRateChange !== null ? `${stats.completionRateChange >= 0 ? '+' : ''}${stats.completionRateChange}%` : null}
          icon={TrendingUp}
          color="bg-blue-500"
          isPositive={stats.completionRateChange === null || stats.completionRateChange >= 0}
          vsLastWeekText={t('creatorDashboard.stats.vsLastWeek')}
          noPreviousDataText={t('creatorDashboard.stats.noPreviousData')}
        />
      </div>

      {/* Health Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard
          title={t('creatorDashboard.stats.atRiskStudents')}
          value={stats.atRiskCount.toString()}
          change={stats.atRiskCount > 0 ? t('creatorDashboard.stats.needAttention', { count: stats.atRiskCount }) : t('creatorDashboard.stats.allHealthy')}
          icon={AlertTriangle}
          color="bg-rose-500"
          isPositive={stats.atRiskCount === 0}
          showChange={false}
        />
        <StatCard
          title={t('creatorDashboard.stats.inactive7d')}
          value={stats.inactiveCount.toString()}
          change={stats.inactiveCount > 0 ? t('creatorDashboard.stats.needAttention', { count: stats.inactiveCount }) : t('creatorDashboard.stats.allActive')}
          icon={Clock}
          color="bg-amber-500"
          isPositive={stats.inactiveCount === 0}
          showChange={false}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 mb-6">{t('creatorDashboard.chart.title')}</h2>
          <div className="h-80 w-full">
            {activityData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData}>
                  <defs>
                    <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                  <Tooltip />
                  <Area type="monotone" dataKey="active" stroke="#4f46e5" fillOpacity={1} fill="url(#colorActive)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                {t('creatorDashboard.chart.noData')}
              </div>
            )}
          </div>
        </div>

        {/* At Risk List */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-900">{t('creatorDashboard.atRisk.title')}</h2>
            <span className="text-xs font-semibold bg-rose-100 text-rose-700 px-2 py-1 rounded-full">
              {t('creatorDashboard.atRisk.needsAttention', { count: atRiskStudents.length })}
            </span>
          </div>
          {/* Homework Completion Stats */}
          {stats.homeworkTotalAssignments > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-amber-800">
                  {t('creatorDashboard.homework.completionLabel')}
                </span>
                <span className="text-sm font-bold text-amber-900">
                  {stats.homeworkTotalSubmissions} / {stats.homeworkExpectedSubmissions}
                </span>
              </div>
              {stats.homeworkExpectedSubmissions > 0 && (
                <div className="mt-2">
                  <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.round((stats.homeworkTotalSubmissions / stats.homeworkExpectedSubmissions) * 100))}%`
                      }}
                    />
                  </div>
                </div>
              )}
              {/* Students with missing homework */}
              {studentsWithMissingHomework.length > 0 && (
                <div className="mt-3 pt-3 border-t border-amber-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-amber-800">
                      {t('creatorDashboard.homework.studentsWithMissing', { count: studentsWithMissingHomework.length })}
                    </p>
                    {studentsWithMissingHomework.length > 5 && (
                      <button
                        onClick={() => setIsHomeworkExpanded(!isHomeworkExpanded)}
                        className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1 transition-colors"
                      >
                        {isHomeworkExpanded ? (
                          <>
                            {t('creatorDashboard.homework.showLess')}
                            <ChevronUp size={14} />
                          </>
                        ) : (
                          <>
                            {t('creatorDashboard.homework.showAll')}
                            <ChevronDown size={14} />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <div className={`space-y-2 overflow-y-auto transition-all duration-300 ${isHomeworkExpanded ? 'max-h-64' : 'max-h-32'}`}>
                    {(isHomeworkExpanded ? studentsWithMissingHomework : studentsWithMissingHomework.slice(0, 5)).map(student => (
                      <button
                        key={student.id}
                        onClick={() => setSelectedHomeworkStudent(student)}
                        className="w-full flex items-center justify-between bg-white/60 hover:bg-white/80 rounded px-2 py-1.5 transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {student.avatar_url ? (
                            <img src={student.avatar_url} alt={student.name} className="w-6 h-6 rounded-full object-cover" loading="lazy" decoding="async" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 text-xs font-semibold">
                              {student.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-xs text-amber-900 truncate">{student.name}</span>
                        </div>
                        <span className="text-xs font-medium text-amber-700 whitespace-nowrap ml-2">
                          {student.submittedCount}/{student.totalAssignments}
                        </span>
                      </button>
                    ))}
                    {!isHomeworkExpanded && studentsWithMissingHomework.length > 5 && (
                      <button
                        onClick={() => setIsHomeworkExpanded(true)}
                        className="w-full text-xs text-amber-600 hover:text-amber-800 text-center py-1 transition-colors"
                      >
                        {t('creatorDashboard.homework.andMoreStudents', { count: studentsWithMissingHomework.length - 5 })}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="space-y-4">
            {atRiskStudents.length > 0 ? (
              atRiskStudents.map(student => (
                <div key={student.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                  {student.avatar_url ? (
                    <img src={student.avatar_url} alt={student.name} className="w-10 h-10 rounded-full" loading="lazy" decoding="async" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-semibold">
                      {student.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="text-sm font-semibold text-slate-900 truncate">{student.name}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold
                        ${student.risk_score >= 80 ? 'bg-rose-100 text-rose-600' : 'bg-orange-100 text-orange-600'}
                      `}>
                        {student.risk_score >= 80 ? t('creatorDashboard.atRisk.critical') : t('creatorDashboard.atRisk.high')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{student.reason}</p>
                    {student.course_title && (
                      <p className="text-xs text-indigo-500 mt-1">{student.course_title}</p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => setSelectedStudent(student)}
                        className="flex-1 bg-white border border-slate-200 text-slate-600 text-xs py-1 rounded hover:bg-slate-50"
                      >
                        {t('creatorDashboard.atRisk.profileButton')}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedStudent(student);
                          setShowMessageModal(true);
                        }}
                        className="flex-1 bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs py-1 rounded hover:bg-indigo-100"
                      >
                        {t('creatorDashboard.atRisk.messageButton')}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-400">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('creatorDashboard.atRisk.emptyTitle')}</p>
                <p className="text-xs mt-1">{t('creatorDashboard.atRisk.emptyDescription')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tasks Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <TasksPanel />
      </div>

      {/* Student Profile Modal */}
      {selectedStudent && !showMessageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-6 text-white">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  {selectedStudent.avatar_url ? (
                    <img src={selectedStudent.avatar_url} alt={selectedStudent.name} className="w-16 h-16 rounded-full border-2 border-white/30" loading="lazy" decoding="async" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                      {selectedStudent.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-bold">{selectedStudent.name}</h3>
                    <p className="text-white/80 text-sm">{selectedStudent.course_title || t('creatorDashboard.studentProfile.noCourse')}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-600">{t('creatorDashboard.studentProfile.riskScore')}</span>
                <span className={`text-sm font-bold px-2 py-1 rounded-full ${
                  selectedStudent.risk_score >= 80 ? 'bg-rose-100 text-rose-600' : 'bg-orange-100 text-orange-600'
                }`}>
                  {selectedStudent.risk_score}/100
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-600">{t('creatorDashboard.studentProfile.status')}</span>
                <span className={`text-sm font-bold ${
                  selectedStudent.risk_score >= 80 ? 'text-rose-600' : 'text-orange-600'
                }`}>
                  {selectedStudent.risk_score >= 80 ? t('creatorDashboard.studentProfile.critical') : t('creatorDashboard.studentProfile.atRisk')}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-600">{t('creatorDashboard.studentProfile.reasonForRisk')}</span>
                <p className="text-sm text-slate-900 mt-1">{selectedStudent.reason}</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowMessageModal(true);
                  }}
                  className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors"
                >
                  <Mail size={16} />
                  {t('creatorDashboard.studentProfile.sendMessage')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Message Modal */}
      {showMessageModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  {selectedStudent.avatar_url ? (
                    <img src={selectedStudent.avatar_url} alt={selectedStudent.name} className="w-10 h-10 rounded-full" loading="lazy" decoding="async" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                      {selectedStudent.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-slate-900">{t('creatorDashboard.message.title', { name: selectedStudent.name })}</h3>
                    <p className="text-xs text-slate-500">{t('creatorDashboard.message.subtitle')}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowMessageModal(false);
                    setMessageText('');
                  }}
                  className="p-1 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700">
                  <strong>{t('creatorDashboard.message.riskReason')}</strong> {selectedStudent.reason}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{t('creatorDashboard.message.yourMessage')}</label>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={t('creatorDashboard.message.placeholder')}
                  className="w-full h-32 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowMessageModal(false);
                    setMessageText('');
                  }}
                  className="flex-1 py-2 px-4 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {t('creatorDashboard.message.cancel')}
                </button>
                <button
                  onClick={async () => {
                    if (!messageText.trim() || !profile?.id || !selectedStudent.community_id) return;
                    setSendingMessage(true);
                    try {
                      // Get or create conversation with the student
                      const conversation = await getOrCreateCreatorConversation(
                        selectedStudent.community_id,
                        profile.id,
                        selectedStudent.user_id
                      );
                      if (conversation) {
                        // Send the message
                        const sent = await sendMessage(conversation.id, profile.id, messageText.trim());
                        if (sent) {
                          showToast(t('creatorDashboard.message.sentSuccess', { name: selectedStudent.name }));
                        } else {
                          showToast(t('creatorDashboard.message.sendError'));
                        }
                      } else {
                        showToast(t('creatorDashboard.message.sendError'));
                      }
                    } catch (error) {
                      console.error('Error sending message:', error);
                      showToast(t('creatorDashboard.message.sendError'));
                    } finally {
                      setSendingMessage(false);
                      setShowMessageModal(false);
                      setSelectedStudent(null);
                      setMessageText('');
                    }
                  }}
                  disabled={!messageText.trim() || sendingMessage || !selectedStudent.community_id}
                  className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingMessage ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Mail size={16} />
                  )}
                  {t('creatorDashboard.message.sendButton')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Homework Student Detail Modal */}
      {selectedHomeworkStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  {selectedHomeworkStudent.avatar_url ? (
                    <img src={selectedHomeworkStudent.avatar_url} alt={selectedHomeworkStudent.name} className="w-16 h-16 rounded-full border-2 border-white/30 object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                      {selectedHomeworkStudent.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-bold">{selectedHomeworkStudent.name}</h3>
                    <p className="text-white/80 text-sm">{selectedHomeworkStudent.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedHomeworkStudent(null)}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {/* Progress Overview */}
              <div className="bg-amber-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-amber-800">{t('creatorDashboard.homework.modal.progress')}</span>
                  <span className="text-sm font-bold text-amber-900">
                    {selectedHomeworkStudent.submittedCount} / {selectedHomeworkStudent.totalAssignments}
                  </span>
                </div>
                <div className="h-3 bg-amber-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-300"
                    style={{
                      width: `${selectedHomeworkStudent.totalAssignments > 0
                        ? Math.round((selectedHomeworkStudent.submittedCount / selectedHomeworkStudent.totalAssignments) * 100)
                        : 0}%`
                    }}
                  />
                </div>
                <p className="text-xs text-amber-600 mt-2">
                  {t('creatorDashboard.homework.modal.completionRate', {
                    rate: selectedHomeworkStudent.totalAssignments > 0
                      ? Math.round((selectedHomeworkStudent.submittedCount / selectedHomeworkStudent.totalAssignments) * 100)
                      : 0
                  })}
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-slate-900">{selectedHomeworkStudent.totalAssignments}</p>
                  <p className="text-xs text-slate-500">{t('creatorDashboard.homework.modal.totalAssignments')}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{selectedHomeworkStudent.submittedCount}</p>
                  <p className="text-xs text-emerald-600">{t('creatorDashboard.homework.modal.submitted')}</p>
                </div>
                <div className="bg-rose-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-rose-600">{selectedHomeworkStudent.missingCount}</p>
                  <p className="text-xs text-rose-600">{t('creatorDashboard.homework.modal.missing')}</p>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-600">{t('creatorDashboard.homework.modal.status')}</span>
                <span className={`text-sm font-bold px-2 py-1 rounded-full ${
                  selectedHomeworkStudent.missingCount === 0
                    ? 'bg-emerald-100 text-emerald-600'
                    : selectedHomeworkStudent.missingCount >= 3
                      ? 'bg-rose-100 text-rose-600'
                      : 'bg-amber-100 text-amber-600'
                }`}>
                  {selectedHomeworkStudent.missingCount === 0
                    ? t('creatorDashboard.homework.modal.statusComplete')
                    : selectedHomeworkStudent.missingCount >= 3
                      ? t('creatorDashboard.homework.modal.statusBehind')
                      : t('creatorDashboard.homework.modal.statusPartial')}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleViewLectures(selectedHomeworkStudent)}
                  className="flex-1 bg-indigo-600 text-white py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors"
                >
                  <Video size={16} />
                  {t('creatorDashboard.lectures.viewLectures')}
                </button>
                <button
                  onClick={() => {
                    // Convert homework student to AtRiskStudent format for the message modal
                    const studentForMessage: AtRiskStudent = {
                      id: selectedHomeworkStudent.id,
                      user_id: selectedHomeworkStudent.user_id,
                      name: selectedHomeworkStudent.name,
                      email: selectedHomeworkStudent.email,
                      avatar_url: selectedHomeworkStudent.avatar_url,
                      risk_score: 0,
                      status: 'at_risk',
                      reason: t('creatorDashboard.homework.modal.reminderReason', {
                        count: selectedHomeworkStudent.missingCount
                      }),
                      last_activity_at: null,
                      community_id: selectedHomeworkStudent.communityIds?.[0],
                    };
                    setSelectedStudent(studentForMessage);
                    setSelectedHomeworkStudent(null);
                    setShowMessageModal(true);
                  }}
                  className="flex-1 bg-amber-600 text-white py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-amber-700 transition-colors"
                >
                  <Mail size={16} />
                  {t('creatorDashboard.homework.modal.sendReminder')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lectures View Modal */}
      {showLecturesView && selectedHomeworkStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-6 text-white">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  {selectedHomeworkStudent.avatar_url ? (
                    <img src={selectedHomeworkStudent.avatar_url} alt={selectedHomeworkStudent.name} className="w-16 h-16 rounded-full border-2 border-white/30 object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                      {selectedHomeworkStudent.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-bold">{selectedHomeworkStudent.name}</h3>
                    <p className="text-white/80 text-sm">{t('creatorDashboard.lectures.title')}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowLecturesView(false);
                    setLectureData(null);
                  }}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {isLoadingLectures ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
              ) : lectureData ? (
                <>
                  {/* Attendance Stats */}
                  <div className="bg-indigo-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-indigo-800">{t('creatorDashboard.lectures.attendance')}</span>
                      <span className="text-sm font-bold text-indigo-900">
                        {lectureData.stats.attendedEvents} / {lectureData.stats.totalEvents}
                      </span>
                    </div>
                    <div className="h-3 bg-indigo-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${lectureData.stats.attendanceRate}%` }}
                      />
                    </div>
                    <p className="text-xs text-indigo-600 mt-2">
                      {t('creatorDashboard.lectures.attendanceRate', { rate: lectureData.stats.attendanceRate })}
                    </p>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-emerald-600">{lectureData.stats.attendedEvents}</p>
                      <p className="text-xs text-emerald-600">{t('creatorDashboard.lectures.attended')}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-slate-600">{lectureData.stats.totalEvents - lectureData.stats.attendedEvents}</p>
                      <p className="text-xs text-slate-500">{t('creatorDashboard.lectures.missed')}</p>
                    </div>
                  </div>

                  {/* Events List */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-3">{t('creatorDashboard.lectures.eventHistory')}</h4>
                    {lectureData.events.length === 0 ? (
                      <div className="text-center py-6 text-slate-400">
                        <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{t('creatorDashboard.lectures.noEvents')}</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {lectureData.events.map(event => (
                          <div
                            key={event.id}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              event.attended
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900 truncate">{event.title}</p>
                              <p className="text-xs text-slate-500">
                                {new Date(event.start_time).toLocaleDateString()}
                                {event.community_name && ` · ${event.community_name}`}
                              </p>
                            </div>
                            <div className="ml-3 shrink-0">
                              {event.attended ? (
                                <CheckCircle size={20} className="text-emerald-500" />
                              ) : (
                                <XCircle size={20} className="text-slate-400" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-sm">{t('creatorDashboard.lectures.loadError')}</p>
                </div>
              )}
            </div>

            {/* Back Button */}
            <div className="border-t border-slate-200 p-4">
              <button
                onClick={() => {
                  setShowLecturesView(false);
                  setLectureData(null);
                }}
                className="w-full flex items-center justify-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
              >
                <ArrowLeft size={16} />
                {t('creatorDashboard.lectures.backToProfile')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Community Modal */}
      {showCreateCommunityModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-6 text-white">
              <h3 className="text-xl font-bold">{t('creatorDashboard.createCommunity.title')}</h3>
              <p className="text-white/80 text-sm mt-1">{t('creatorDashboard.createCommunity.subtitle')}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{t('creatorDashboard.createCommunity.nameLabel')}</label>
                <input
                  type="text"
                  value={newCommunityName}
                  onChange={(e) => setNewCommunityName(e.target.value)}
                  placeholder={t('creatorDashboard.createCommunity.namePlaceholder')}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                />
                <p className="text-xs text-slate-500 mt-2">
                  {t('creatorDashboard.createCommunity.nameHint')}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-slate-700 mb-2">{t('creatorDashboard.createCommunity.whatYouGet')}</h4>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> {t('creatorDashboard.createCommunity.feature1')}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> {t('creatorDashboard.createCommunity.feature2')}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> {t('creatorDashboard.createCommunity.feature3')}
                  </li>
                </ul>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowCreateCommunityModal(false);
                    setNewCommunityName('');
                  }}
                  className="flex-1 py-2.5 px-4 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {t('creatorDashboard.createCommunity.cancel')}
                </button>
                <button
                  onClick={handleCreateCommunity}
                  disabled={!newCommunityName.trim() || creatingCommunity}
                  className="flex-1 bg-indigo-600 text-white py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingCommunity ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Plus size={18} />
                  )}
                  {t('creatorDashboard.createCommunity.createButton')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-6 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <FileText size={24} />
                    {t('creatorDashboard.report.modalTitle')}
                  </h3>
                  <p className="text-white/80 text-sm mt-1">
                    {report?.title || t('creatorDashboard.report.generating')}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowReportModal(false);
                    setReport(null);
                  }}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {isGeneratingReport ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
                  <p className="text-slate-600">{t('creatorDashboard.report.generatingMessage')}</p>
                  <p className="text-slate-400 text-sm mt-1">{t('creatorDashboard.report.generatingHint')}</p>
                </div>
              ) : report ? (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="bg-indigo-50 rounded-lg p-4">
                    <p className="text-sm text-slate-700">{report.summary}</p>
                  </div>

                  {/* Sections */}
                  {report.sections.map((section, index) => (
                    <div key={index} className="bg-slate-50 rounded-lg p-4">
                      <h4 className="font-semibold text-slate-900 mb-3">{section.title}</h4>
                      <div className="text-sm text-slate-700 whitespace-pre-wrap">
                        <AiResponseText text={section.content} />
                      </div>
                    </div>
                  ))}

                  {/* AI Insights */}
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-100">
                    <h4 className="font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                      <Sparkles size={16} className="text-indigo-600" />
                      {t('creatorDashboard.report.aiInsightsTitle')}
                    </h4>
                    <div className="text-sm text-slate-700">
                      <AiResponseText text={report.aiInsights} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  {t('creatorDashboard.report.noReportYet')}
                </div>
              )}
            </div>

            {/* Footer with actions */}
            {report && !isGeneratingReport && (
              <div className="border-t border-slate-200 p-4 flex justify-between items-center bg-slate-50">
                <p className="text-xs text-slate-500">
                  {t('creatorDashboard.report.generatedAt', {
                    date: new Date(report.generatedAt).toLocaleString()
                  })}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadCSV}
                    className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors text-sm font-medium"
                  >
                    <Download size={16} />
                    {t('creatorDashboard.report.downloadCSV')}
                  </button>
                  <button
                    onClick={handleGenerateReport}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                  >
                    <Sparkles size={16} />
                    {t('creatorDashboard.report.regenerate')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-emerald-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in z-50">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
