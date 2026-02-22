import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { X, Loader2, MessageSquare, FileText, Calendar, MessageCircle, User, Award, ChevronLeft, CheckCircle, Clock, BookOpen, CalendarCheck } from 'lucide-react';
import { getUserProfileForPopup, UserProfilePopupData, getStudentProgressInCommunity, StudentProgressData } from './communityService';
import { getTeamMemberByProfile, isTeamMember as checkIsTeamMember } from '../direct-messages/teamService';
import type { TeamMemberWithProfile } from '../direct-messages/dmTypes';
import { getBadgeType } from '../direct-messages/dmTypes';
import { useCommunity } from '../../core/contexts/CommunityContext';
import { useAuth } from '../../core/contexts/AuthContext';
import { awardPoints } from './pointsService';

interface UserProfilePopupProps {
  profileId: string;
  isOpen: boolean;
  onClose: () => void;
}

const UserProfilePopup: React.FC<UserProfilePopupProps> = ({
  profileId,
  isOpen,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { selectedCommunity } = useCommunity();
  const { profile: currentUserProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfilePopupData | null>(null);
  const [teamMember, setTeamMember] = useState<TeamMemberWithProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Give Points state
  const [canAwardPoints, setCanAwardPoints] = useState(false);
  const [showGivePoints, setShowGivePoints] = useState(false);
  const [givePointsAmount, setGivePointsAmount] = useState(5);
  const [givePointsReason, setGivePointsReason] = useState('');
  const [isAwardingPoints, setIsAwardingPoints] = useState(false);

  // Progress view state
  const [showProgressView, setShowProgressView] = useState(false);
  const [progressData, setProgressData] = useState<StudentProgressData | null>(null);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);
  const [progressTab, setProgressTab] = useState<'homework' | 'lessons' | 'events'>('homework');

  // Determine creator-student messaging eligibility
  const isViewerCreator = currentUserProfile?.id === selectedCommunity?.creator_id;
  const isProfileCreator = profileId === selectedCommunity?.creator_id;
  const isViewingOwnProfile = currentUserProfile?.id === profileId;

  // Can show creator-student DM button if:
  // 1. Not viewing own profile
  // 2. Not a team member (team members use their own DM flow)
  // 3. Either: viewer is creator AND profile is a student, OR viewer is student AND profile is creator
  const canShowCreatorStudentDM = !isViewingOwnProfile && !teamMember && (
    (isViewerCreator && !isProfileCreator) || // Creator viewing student
    (!isViewerCreator && isProfileCreator)     // Student viewing creator
  );

  useEffect(() => {
    if (isOpen && profileId) {
      loadProfile();
    }
  }, [isOpen, profileId, selectedCommunity?.id]);

  const loadProfile = async () => {
    setIsLoading(true);
    setError(null);
    setTeamMember(null);
    setCanAwardPoints(false);
    setShowGivePoints(false);

    const data = await getUserProfileForPopup(profileId);
    if (data) {
      setProfile(data);

      // Check if this profile is a team member in the current community
      if (selectedCommunity?.id) {
        const teamMemberData = await getTeamMemberByProfile(selectedCommunity.id, profileId);
        setTeamMember(teamMemberData);

        // Check if current user can award points (is owner or team member)
        if (currentUserProfile?.id) {
          const isOwner = currentUserProfile.id === selectedCommunity.creator_id;
          const isCurrentUserTeamMember = await checkIsTeamMember(selectedCommunity.id, currentUserProfile.id);
          setCanAwardPoints(isOwner || isCurrentUserTeamMember);
        }
      }
    } else {
      setError(t('communityHub.userProfile.errorLoad'));
    }
    setIsLoading(false);
  };

  const handleSendMessage = () => {
    if (teamMember) {
      // Navigate to community with chat open for this team member
      navigate(`/community?openChat=${teamMember.id}`);
      onClose();
    }
  };

  const handleViewProfile = () => {
    if (teamMember && selectedCommunity) {
      navigate(`/community/${selectedCommunity.id}/team/${teamMember.id}`);
      onClose();
    }
  };

  const handleSendCreatorStudentMessage = () => {
    if (!selectedCommunity) return;

    if (isViewerCreator) {
      // Creator messaging student - pass student's profile ID
      navigate(`/community?openCreatorChat=${profileId}`);
    } else {
      // Student messaging creator - use 'creator' as marker
      navigate(`/community?openCreatorChat=creator`);
    }
    onClose();
  };

  const handleAwardPoints = async () => {
    if (!selectedCommunity || !profileId || givePointsAmount < 1 || givePointsAmount > 100) return;

    setIsAwardingPoints(true);
    try {
      const result = await awardPoints(
        profileId,
        selectedCommunity.id,
        givePointsAmount,
        givePointsReason || t('communityHub.givePoints.defaultReason')
      );

      if (result) {
        setShowGivePoints(false);
        setGivePointsAmount(5);
        setGivePointsReason('');
      }
    } catch (error) {
      console.error('Error awarding points:', error);
    } finally {
      setIsAwardingPoints(false);
    }
  };

  const handleViewProgress = async () => {
    if (!selectedCommunity || !profileId) return;

    setShowProgressView(true);
    setIsLoadingProgress(true);
    setProgressTab('homework');

    try {
      const data = await getStudentProgressInCommunity(profileId, selectedCommunity.id);
      setProgressData(data);
    } catch (error) {
      console.error('Error loading student progress:', error);
    } finally {
      setIsLoadingProgress(false);
    }
  };

  const handleBackToProfile = () => {
    setShowProgressView(false);
    setProgressData(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(i18n.language === 'bg' ? 'bg-BG' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatJoinDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(i18n.language === 'bg' ? 'bg-BG' : 'en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  const getRoleBadge = (role: string) => {
    // If user is a team member, show team badge
    if (teamMember) {
      const badgeType = getBadgeType(teamMember.role);
      return (
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
          badgeType === 'guest' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
        }`}>
          {t(`directMessages.badge.${badgeType}`)}
        </span>
      );
    }

    switch (role) {
      case 'creator':
        return (
          <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-semibold">
            {t('communityHub.userProfile.role.creator')}
          </span>
        );
      case 'superadmin':
        return (
          <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-semibold">
            {t('communityHub.userProfile.role.admin')}
          </span>
        );
      case 'student':
        return (
          <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-semibold">
            {t('communityHub.userProfile.role.student')}
          </span>
        );
      default:
        return (
          <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full font-semibold">
            {t('communityHub.userProfile.role.member')}
          </span>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-sm shadow-xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress View */}
        {showProgressView ? (
          <div className="p-6">
            {/* Back Button & Header */}
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={handleBackToProfile}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronLeft size={20} className="text-slate-600" />
              </button>
              <div>
                <h3 className="font-bold text-slate-900">{profile?.full_name}</h3>
                <p className="text-sm text-slate-500">{t('communityHub.userProfile.progressTitle')}</p>
              </div>
            </div>

            {isLoadingProgress ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : progressData ? (
              <>
                {/* Stats Summary */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-emerald-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-emerald-700">
                      {progressData.stats.gradedHomework}/{progressData.stats.totalHomework}
                    </div>
                    <div className="text-xs text-emerald-600">{t('communityHub.userProfile.progress.homework')}</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-blue-700">
                      {progressData.stats.completedLessons}/{progressData.stats.totalLessons}
                    </div>
                    <div className="text-xs text-blue-600">{t('communityHub.userProfile.progress.lessons')}</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-purple-700">
                      {progressData.stats.attendedEvents}/{progressData.stats.totalEvents}
                    </div>
                    <div className="text-xs text-purple-600">{t('communityHub.userProfile.progress.events')}</div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 mb-4">
                  <button
                    onClick={() => setProgressTab('homework')}
                    className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                      progressTab === 'homework'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t('communityHub.userProfile.progress.homeworkTab')}
                  </button>
                  <button
                    onClick={() => setProgressTab('lessons')}
                    className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                      progressTab === 'lessons'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t('communityHub.userProfile.progress.lessonsTab')}
                  </button>
                  <button
                    onClick={() => setProgressTab('events')}
                    className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                      progressTab === 'events'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t('communityHub.userProfile.progress.eventsTab')}
                  </button>
                </div>

                {/* Tab Content */}
                <div className="max-h-64 overflow-y-auto">
                  {progressTab === 'homework' && (
                    <div className="space-y-2">
                      {progressData.homework.length === 0 ? (
                        <p className="text-center text-slate-400 py-4 text-sm">
                          {t('communityHub.userProfile.progress.noHomework')}
                        </p>
                      ) : (
                        progressData.homework.map((hw) => (
                          <div key={hw.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-900 text-sm truncate">{hw.title}</p>
                              <p className="text-xs text-slate-500">{formatDate(hw.submittedAt)}</p>
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                              {hw.status === 'graded' ? (
                                <span className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                                  <CheckCircle size={14} />
                                  {hw.pointsAwarded}/{hw.maxPoints}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-amber-600 text-sm">
                                  <Clock size={14} />
                                  {t('communityHub.userProfile.progress.pending')}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {progressTab === 'lessons' && (
                    <div className="space-y-2">
                      {progressData.lessons.length === 0 ? (
                        <p className="text-center text-slate-400 py-4 text-sm">
                          {t('communityHub.userProfile.progress.noLessons')}
                        </p>
                      ) : (
                        progressData.lessons.map((lesson) => (
                          <div key={lesson.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-900 text-sm truncate">{lesson.title}</p>
                              <p className="text-xs text-slate-500">{lesson.courseName}</p>
                            </div>
                            <div className="flex items-center gap-1 text-emerald-600 text-xs ml-2">
                              <CheckCircle size={14} />
                              {formatDate(lesson.completedAt)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {progressTab === 'events' && (
                    <div className="space-y-2">
                      {progressData.events.length === 0 ? (
                        <p className="text-center text-slate-400 py-4 text-sm">
                          {t('communityHub.userProfile.progress.noEvents')}
                        </p>
                      ) : (
                        progressData.events.map((event) => (
                          <div key={event.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-900 text-sm truncate">{event.title}</p>
                              <p className="text-xs text-slate-500">{formatDate(event.eventDate)}</p>
                            </div>
                            <div className="ml-2">
                              {event.attended ? (
                                <span className="flex items-center gap-1 text-emerald-600 text-xs">
                                  <CalendarCheck size={14} />
                                  {t('communityHub.userProfile.progress.attended')}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">
                                  {t('communityHub.userProfile.progress.registered')}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="w-full mt-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                >
                  {t('communityHub.userProfile.close')}
                </button>
              </>
            ) : null}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="relative bg-gradient-to-br from-indigo-500 to-purple-600 h-24 rounded-t-xl">
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
              >
                <X size={16} className="text-white" />
              </button>

              {/* Avatar - positioned at bottom of header, extending below */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2">
                <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden bg-slate-100">
                  {isLoading ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                    </div>
                  ) : (
                    <img
                      src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || 'User')}&background=6366f1&color=fff&size=128`}
                      alt={profile?.full_name || 'User'}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Profile Content */}
            <div className="px-6 pb-6 pt-14">

              {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-slate-500">{error}</p>
              <button
                onClick={loadProfile}
                className="mt-2 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
              >
                {t('communityHub.userProfile.tryAgain')}
              </button>
            </div>
          ) : profile ? (
            <>
              {/* Name and Role */}
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-slate-900 mb-1">
                  {profile.full_name}
                </h3>
                {getRoleBadge(profile.role)}
              </div>

              {/* Bio */}
              {profile.bio && (
                <p className="text-center text-slate-600 text-sm mb-4 px-2">
                  {profile.bio}
                </p>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center text-slate-400 mb-1">
                    <FileText size={16} />
                  </div>
                  <div className="text-lg font-bold text-slate-900">{profile.postsCount}</div>
                  <div className="text-xs text-slate-500">{t('communityHub.userProfile.stats.posts')}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center text-slate-400 mb-1">
                    <MessageSquare size={16} />
                  </div>
                  <div className="text-lg font-bold text-slate-900">{profile.commentsCount}</div>
                  <div className="text-xs text-slate-500">{t('communityHub.userProfile.stats.comments')}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center text-slate-400 mb-1">
                    <Calendar size={16} />
                  </div>
                  <div className="text-sm font-medium text-slate-900 leading-tight">
                    {formatJoinDate(profile.joined_at)}
                  </div>
                  <div className="text-xs text-slate-500">{t('communityHub.userProfile.stats.joined')}</div>
                </div>
              </div>

              {/* Team Member Actions */}
              {teamMember && teamMember.is_messageable && (
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={handleSendMessage}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                  >
                    <MessageCircle size={18} />
                    {t('directMessages.actions.sendMessage')}
                  </button>
                  <button
                    onClick={handleViewProfile}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                  >
                    <User size={18} />
                  </button>
                </div>
              )}

              {/* Team Member - View Profile Only (not messageable) */}
              {teamMember && !teamMember.is_messageable && (
                <button
                  onClick={handleViewProfile}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors mb-3"
                >
                  <User size={18} />
                  {t('directMessages.actions.viewProfile')}
                </button>
              )}

              {/* Creator-Student Direct Message */}
              {canShowCreatorStudentDM && (
                <button
                  onClick={handleSendCreatorStudentMessage}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors mb-3"
                >
                  <MessageCircle size={18} />
                  {isViewerCreator
                    ? t('communityHub.userProfile.sendMessageToStudent')
                    : t('communityHub.userProfile.sendMessageToCreator')
                  }
                </button>
              )}

              {/* View Progress Button - for creators and team members viewing students */}
              {canAwardPoints && !isViewingOwnProfile && !isProfileCreator && (
                <button
                  onClick={handleViewProgress}
                  className="w-full flex items-center justify-center gap-2 py-2.5 mb-3 border border-indigo-200 text-indigo-600 rounded-lg font-medium hover:bg-indigo-50 transition-colors"
                >
                  <BookOpen size={18} />
                  {t('communityHub.userProfile.viewProgress')}
                </button>
              )}

              {/* Give Points Section - for creators and team members */}
              {canAwardPoints && !isViewingOwnProfile && (
                <div className="mb-3">
                  {!showGivePoints ? (
                    <button
                      onClick={() => setShowGivePoints(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-lg font-medium transition-colors"
                    >
                      <Award size={18} />
                      {t('communityHub.givePoints.buttonLabel')}
                    </button>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-amber-800 flex items-center gap-2">
                          <Award size={16} />
                          {t('communityHub.givePoints.title')}
                        </h4>
                        <button
                          onClick={() => setShowGivePoints(false)}
                          disabled={isAwardingPoints}
                          className="text-amber-600 hover:text-amber-800"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {/* Points slider */}
                      <div>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="1"
                            max="100"
                            value={givePointsAmount}
                            onChange={(e) => setGivePointsAmount(Number(e.target.value))}
                            className="flex-1 h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                          />
                          <span className="text-xl font-bold text-amber-600 w-12 text-center">
                            {givePointsAmount}
                          </span>
                        </div>
                      </div>

                      {/* Reason input */}
                      <input
                        type="text"
                        value={givePointsReason}
                        onChange={(e) => setGivePointsReason(e.target.value)}
                        placeholder={t('communityHub.givePoints.reasonPlaceholder')}
                        className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      />

                      {/* Award button */}
                      <button
                        onClick={handleAwardPoints}
                        disabled={isAwardingPoints || givePointsAmount < 1}
                        className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isAwardingPoints ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {t('communityHub.givePoints.awarding')}
                          </>
                        ) : (
                          t('communityHub.givePoints.awardButton', { points: givePointsAmount })
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Close Button */}
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
              >
                {t('communityHub.userProfile.close')}
              </button>
            </>
          ) : null}
        </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UserProfilePopup;
