import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  MessageCircle,
  BookOpen,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Avatar } from '../../../shared/Avatar';
import { getBadgeType } from '../dmTypes';
import { getTeamMemberProfile } from '../teamService';
import type { TeamMemberWithProfile, TeamMemberRole } from '../dmTypes';

/**
 * Get role badge styling based on badge type
 */
function getRoleBadgeClasses(role: TeamMemberRole): { bg: string; text: string } {
  const badgeType = getBadgeType(role);
  if (badgeType === 'guest') {
    return {
      bg: 'bg-[#EAB308]/10',
      text: 'text-[#EAB308]',
    };
  }
  return {
    bg: 'bg-[var(--fc-section-hover,#1F1F1F)]',
    text: 'text-[var(--fc-section-muted,#A0A0A0)]',
  };
}

interface ProfileData {
  teamMember: TeamMemberWithProfile;
  community: { id: string; name: string };
  courses: Array<{ id: string; title: string; thumbnail_url: string | null }>;
}

/**
 * TeamProfilePage - Full profile page for team members
 *
 * Route: /community/:communityId/team/:memberId
 *
 * Shows:
 * - Avatar, name, title, bio
 * - Role badge (Team/Guest)
 * - Courses they teach
 * - "Send Message" button
 * - Back to community link
 */
const TeamProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { communityId, memberId } = useParams<{ communityId: string; memberId: string }>();
  const navigate = useNavigate();

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (communityId && memberId) {
      loadProfile();
    }
  }, [communityId, memberId]);

  const loadProfile = async () => {
    if (!communityId || !memberId) return;

    setIsLoading(true);
    setError(null);

    const data = await getTeamMemberProfile(communityId, memberId);

    if (data) {
      setProfileData(data);
    } else {
      setError(t('directMessages.profilePage.errorNotFound'));
    }

    setIsLoading(false);
  };

  const handleSendMessage = () => {
    if (!profileData) return;
    // Navigate to community with chat open for this team member
    // The chat state will be handled by CommunityHub via URL params
    navigate(`/community?openChat=${memberId}`);
  };

  const handleBackToCommunity = () => {
    if (communityId) {
      navigate('/community');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--fc-section,#0A0A0A)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--fc-section-text,#FAFAFA)] mx-auto mb-3" />
          <p className="text-[var(--fc-section-muted,#666666)]">{t('directMessages.profilePage.loading')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !profileData) {
    return (
      <div className="min-h-screen bg-[var(--fc-section,#0A0A0A)] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[var(--fc-section,#0A0A0A)] rounded-xl border border-[var(--fc-section-border,#1F1F1F)] p-8 text-center">
          <div className="w-16 h-16 bg-[#EF4444]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-[#EF4444]" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--fc-section-text,#FAFAFA)] mb-2">
            {t('directMessages.profilePage.errorTitle')}
          </h2>
          <p className="text-[var(--fc-section-muted,#666666)] mb-6">
            {error || t('directMessages.profilePage.errorNotFound')}
          </p>
          <button
            onClick={handleBackToCommunity}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] rounded-lg font-medium hover:bg-[var(--fc-button-hover,#E0E0E0)] transition-colors"
          >
            <ArrowLeft size={18} />
            {t('directMessages.profilePage.backToCommunity')}
          </button>
        </div>
      </div>
    );
  }

  const { teamMember, community, courses } = profileData;
  const profile = teamMember.profile;
  const displayName = profile?.full_name || t('directMessages.teamCard.unknownMember');
  const title = teamMember.title || t(`directMessages.roles.${teamMember.role}`);
  const badgeStyle = getRoleBadgeClasses(teamMember.role);

  return (
    <div className="min-h-screen bg-[var(--fc-section,#0A0A0A)]">
      {/* Header with gradient */}
      <div className="bg-[var(--fc-section-hover,#1F1F1F)] h-48 relative">
        {/* Back button */}
        <button
          onClick={handleBackToCommunity}
          className="absolute top-6 left-6 flex items-center gap-2 text-white/90 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">{t('directMessages.profilePage.backToCommunity')}</span>
        </button>

        {/* Community name */}
        <div className="absolute top-6 right-6">
          <span className="text-white/80 text-sm">{community.name}</span>
        </div>

        {/* Avatar positioned at bottom */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2">
          <div className="w-32 h-32 rounded-full border-4 border-white overflow-hidden bg-[var(--fc-section,#0A0A0A)]">
            <Avatar
              src={profile?.avatar_url}
              name={displayName}
              size="xl"
              className="w-full h-full"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 pt-20 pb-12">
        {/* Name, badge, title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--fc-section-text,#FAFAFA)] mb-2">{displayName}</h1>
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className={`text-sm px-3 py-1 rounded-full font-semibold ${badgeStyle.bg} ${badgeStyle.text}`}>
              {t(`directMessages.badge.${getBadgeType(teamMember.role)}`)}
            </span>
          </div>
          <p className="text-lg text-[var(--fc-section-muted,#A0A0A0)]">{title}</p>
        </div>

        {/* Bio */}
        {teamMember.bio && (
          <div className="bg-[var(--fc-section,#0A0A0A)] rounded-xl border border-[var(--fc-section-border,#1F1F1F)] p-6 mb-6">
            <h2 className="text-sm font-semibold text-[var(--fc-section-muted,#666666)] uppercase tracking-wide mb-3">
              {t('directMessages.profilePage.about')}
            </h2>
            <p className="text-[var(--fc-section-muted,#A0A0A0)] leading-relaxed whitespace-pre-wrap">
              {teamMember.bio}
            </p>
          </div>
        )}

        {/* Message button */}
        {teamMember.is_messageable && (
          <div className="mb-8">
            <button
              onClick={handleSendMessage}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] rounded-xl font-medium hover:bg-[var(--fc-button-hover,#E0E0E0)] transition-colors"
            >
              <MessageCircle size={20} />
              {t('directMessages.actions.sendMessage')}
            </button>
          </div>
        )}

        {/* Courses they teach */}
        {courses.length > 0 && (
          <div className="bg-[var(--fc-section,#0A0A0A)] rounded-xl border border-[var(--fc-section-border,#1F1F1F)] p-6">
            <h2 className="text-sm font-semibold text-[var(--fc-section-muted,#666666)] uppercase tracking-wide mb-4 flex items-center gap-2">
              <BookOpen size={16} />
              {t('directMessages.profilePage.courses', { count: courses.length })}
            </h2>
            <div className="space-y-3">
              {courses.map(course => (
                <Link
                  key={course.id}
                  to="/courses"
                  className="flex items-center gap-3 p-3 rounded-lg border border-[var(--fc-section-border,#1F1F1F)] hover:border-[var(--fc-section-border,#1F1F1F)] hover:bg-[var(--fc-section-hover,#151515)]/50 transition-colors"
                >
                  {/* Course thumbnail */}
                  <div className="w-16 h-12 rounded-lg overflow-hidden bg-[var(--fc-section-hover,#1F1F1F)] flex-shrink-0">
                    {course.thumbnail_url ? (
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-white/50" />
                      </div>
                    )}
                  </div>
                  <span className="font-medium text-[var(--fc-section-text,#FAFAFA)]">{course.title}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamProfilePage;
