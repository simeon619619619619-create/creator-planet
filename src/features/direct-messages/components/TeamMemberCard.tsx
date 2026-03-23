import React from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, User } from 'lucide-react';
import { Avatar } from '../../../shared/Avatar';
import type { TeamMemberWithProfile, TeamMemberRole } from '../dmTypes';
import { getBadgeType } from '../dmTypes';

interface TeamMemberCardProps {
  teamMember: TeamMemberWithProfile;
  communityId: string;
  onSendMessage?: () => void;
  onViewProfile?: () => void;
  showActions?: boolean;
  compact?: boolean;
}

/**
 * Get role badge styling based on badge type
 */
function getRoleBadgeClasses(role: TeamMemberRole): { bg: string; text: string; label: string } {
  const badgeType = getBadgeType(role);
  if (badgeType === 'guest') {
    return {
      bg: 'bg-[#EAB308]/10',
      text: 'text-[#EAB308]',
      label: 'Guest',
    };
  }
  return {
    bg: 'bg-[#1F1F1F]',
    text: 'text-[#A0A0A0]',
    label: 'Team',
  };
}

/**
 * TeamMemberCard - Reusable profile card/popup for team members
 *
 * Used in:
 * - Post author popups (when clicking team member avatar)
 * - Course pages (instructor section)
 * - Anywhere team member info needs to be displayed
 */
const TeamMemberCard: React.FC<TeamMemberCardProps> = ({
  teamMember,
  communityId,
  onSendMessage,
  onViewProfile,
  showActions = true,
  compact = false,
}) => {
  const { t } = useTranslation();
  const profile = teamMember.profile;

  const displayName = profile?.full_name || t('directMessages.teamCard.unknownMember');
  const title = teamMember.title || t(`directMessages.roles.${teamMember.role}`);
  const bio = teamMember.bio;
  const badgeStyle = getRoleBadgeClasses(teamMember.role);

  if (compact) {
    // Compact version for inline display
    return (
      <div className="flex items-center gap-3 p-3 bg-[#0A0A0A] rounded-lg border border-[#1F1F1F] hover:border-[#1F1F1F] transition-colors">
        <Avatar
          src={profile?.avatar_url}
          name={displayName}
          size="md"
          onClick={onViewProfile}
          className={onViewProfile ? 'cursor-pointer' : ''}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[#FAFAFA] truncate">{displayName}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${badgeStyle.bg} ${badgeStyle.text}`}>
              {t(`directMessages.badge.${getBadgeType(teamMember.role)}`)}
            </span>
          </div>
          <p className="text-sm text-[#666666] truncate">{title}</p>
        </div>
        {showActions && teamMember.is_messageable && onSendMessage && (
          <button
            onClick={onSendMessage}
            className="p-2 text-[#FAFAFA] hover:bg-[#151515] rounded-lg transition-colors"
            title={t('directMessages.actions.sendMessage')}
          >
            <MessageCircle size={18} />
          </button>
        )}
      </div>
    );
  }

  // Full card version (for popups and profile previews)
  return (
    <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] overflow-hidden max-w-sm">
      {/* Header with gradient */}
      <div className="bg-[#1F1F1F] h-16 relative">
        {/* Avatar positioned at bottom, extending below */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2">
          <div className="w-20 h-20 rounded-full border-4 border-white overflow-hidden bg-[#0A0A0A]">
            <Avatar
              src={profile?.avatar_url}
              name={displayName}
              size="xl"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-5 pt-12 text-center">
        {/* Name and badge */}
        <div className="mb-2">
          <h3 className="text-lg font-bold text-[#FAFAFA]">{displayName}</h3>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${badgeStyle.bg} ${badgeStyle.text}`}>
              {t(`directMessages.badge.${getBadgeType(teamMember.role)}`)}
            </span>
          </div>
        </div>

        {/* Title */}
        <p className="text-sm text-[#A0A0A0] font-medium mb-2">{title}</p>

        {/* Bio preview */}
        {bio && (
          <p className="text-sm text-[#666666] mb-4 line-clamp-3">
            {bio}
          </p>
        )}

        {/* Action buttons */}
        {showActions && (
          <div className="flex gap-2 mt-4">
            {teamMember.is_messageable && onSendMessage && (
              <button
                onClick={onSendMessage}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] rounded-lg font-medium hover:bg-[#E0E0E0] transition-colors"
              >
                <MessageCircle size={18} />
                {t('directMessages.actions.sendMessage')}
              </button>
            )}
            {onViewProfile && (
              <button
                onClick={onViewProfile}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                  teamMember.is_messageable && onSendMessage
                    ? 'border border-[#1F1F1F] text-[#A0A0A0] hover:bg-[#0A0A0A]'
                    : 'flex-1 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] hover:bg-[#E0E0E0]'
                }`}
              >
                <User size={18} />
                {t('directMessages.actions.viewProfile')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamMemberCard;
