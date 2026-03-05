// ============================================================================
// TEAM SECTION COMPONENT
// Collapsible section in community sidebar showing team members
// ============================================================================

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, MessageCircle } from 'lucide-react';
import type { TeamMemberWithProfile } from '../dmTypes';
import { getBadgeType } from '../dmTypes';

interface TeamSectionProps {
  teamMembers: TeamMemberWithProfile[];
  onSelectTeamMember: (member: TeamMemberWithProfile) => void;
  selectedTeamMemberId?: string | null;
}

const TeamSection: React.FC<TeamSectionProps> = ({
  teamMembers,
  onSelectTeamMember,
  selectedTeamMemberId,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);

  if (teamMembers.length === 0) {
    return null;
  }

  return (
    <div className="mb-2">
      {/* Section Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="group w-full flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-[#666666] hover:text-[#A0A0A0] uppercase tracking-wider"
      >
        {isExpanded ? (
          <ChevronDown size={14} />
        ) : (
          <ChevronRight size={14} />
        )}
        <span className="flex-1 text-left">{t('directMessages.teamSection.title')}</span>
        <MessageCircle size={12} className="text-[#666666]" />
      </button>

      {/* Team Members List */}
      {isExpanded && (
        <div className="space-y-0.5 mt-0.5">
          {teamMembers.map((member) => {
            const profile = member.profile;
            const displayName = profile?.full_name || member.invited_email || t('directMessages.teamSection.unknown');
            const avatarUrl = profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff`;
            const badgeType = getBadgeType(member.role);
            const hasUnread = (member.unread_count || 0) > 0;
            const isSelected = selectedTeamMemberId === member.id;

            return (
              <button
                key={member.id}
                onClick={() => onSelectTeamMember(member)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left
                  ${isSelected ? 'bg-[#151515]' : 'hover:bg-[#0A0A0A]'}
                `}
              >
                {/* Avatar with unread indicator */}
                <div className="relative shrink-0">
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                  {hasUnread && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-white rounded-full border-2 border-white" />
                  )}
                </div>

                {/* Name and title */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-medium truncate ${isSelected ? 'text-[#A0A0A0]' : 'text-[#A0A0A0]'}`}>
                      {displayName}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0
                        ${badgeType === 'team'
                          ? 'bg-[#1F1F1F] text-[#A0A0A0]'
                          : 'bg-[#EAB308]/10 text-[#EAB308]'
                        }
                      `}
                    >
                      {badgeType === 'team'
                        ? t('directMessages.teamSection.badgeTeam')
                        : t('directMessages.teamSection.badgeGuest')
                      }
                    </span>
                  </div>
                  {member.title && (
                    <p className="text-xs text-[#666666] truncate">{member.title}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TeamSection;
