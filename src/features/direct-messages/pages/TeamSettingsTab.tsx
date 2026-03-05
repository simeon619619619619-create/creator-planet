// ============================================================================
// TEAM SETTINGS TAB
// Manage community team members (lecturers, assistants, guest experts)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  UserPlus,
  Settings,
  X,
  Mail,
  MessageSquare,
  Loader2,
  AlertCircle,
  Link,
  Copy,
  Check,
  Clock,
  Briefcase,
} from 'lucide-react';
import { useCommunity } from '../../../core/contexts/CommunityContext';
import { getTeamMembers, removeTeamMember, cancelInvitation } from '../teamService';
import type { TeamMemberWithProfile, DbCommunityTeamMember } from '../dmTypes';
import { getBadgeType } from '../dmTypes';
import InviteTeamMemberModal from '../components/InviteTeamMemberModal';
import EditTeamMemberModal from '../components/EditTeamMemberModal';
import Avatar from '../../../shared/Avatar';
import ConfirmModal from '../../../shared/ConfirmModal';

const TeamSettingsTab: React.FC = () => {
  const { t } = useTranslation();
  const { selectedCommunity } = useCommunity();

  // State
  const [teamMembers, setTeamMembers] = useState<TeamMemberWithProfile[]>([]);
  const [pendingInvites, setPendingInvites] = useState<DbCommunityTeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMemberWithProfile | null>(null);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'remove' | 'cancelInvite';
    member?: TeamMemberWithProfile;
    invite?: DbCommunityTeamMember;
  }>({ isOpen: false, type: 'remove' });

  // Load team members
  useEffect(() => {
    if (selectedCommunity?.id) {
      loadTeamMembers();
    }
  }, [selectedCommunity?.id]);

  const loadTeamMembers = async (silent = false) => {
    if (!selectedCommunity?.id) return;

    // Only show loading spinner on initial load, not on silent refresh
    if (!silent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const members = await getTeamMembers(selectedCommunity.id);

      // Separate accepted members from pending invites
      const accepted = members.filter(m => m.invite_status === 'accepted');
      const pending = members.filter(m => m.invite_status === 'pending');

      setTeamMembers(accepted);
      setPendingInvites(pending);
    } catch (err) {
      console.error('Error loading team members:', err);
      if (!silent) {
        setError(t('team.settings.errorLoading'));
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  // Show confirm modal for removing a team member
  const handleRemove = (member: TeamMemberWithProfile) => {
    setConfirmModal({
      isOpen: true,
      type: 'remove',
      member,
    });
  };

  // Show confirm modal for canceling a pending invitation
  const handleCancelInvite = (invite: DbCommunityTeamMember) => {
    setConfirmModal({
      isOpen: true,
      type: 'cancelInvite',
      invite,
    });
  };

  // Handle confirmed removal
  const handleConfirmRemove = async () => {
    if (!confirmModal.member) return;

    const member = confirmModal.member;
    setIsRemoving(member.id);

    try {
      const result = await removeTeamMember(member.id);
      if (result.success) {
        setTeamMembers(prev => prev.filter(m => m.id !== member.id));
        setConfirmModal({ isOpen: false, type: 'remove' });
      } else {
        setError(result.error || t('team.settings.errorRemoving'));
      }
    } catch (err) {
      setError(t('team.settings.errorRemoving'));
    } finally {
      setIsRemoving(null);
    }
  };

  // Handle confirmed cancel invitation
  const handleConfirmCancelInvite = async () => {
    if (!confirmModal.invite) return;

    const invite = confirmModal.invite;
    setIsRemoving(invite.id);

    try {
      const result = await cancelInvitation(invite.id);
      if (result.success) {
        setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
        setConfirmModal({ isOpen: false, type: 'cancelInvite' });
      } else {
        setError(result.error || t('team.settings.errorCanceling'));
      }
    } catch (err) {
      setError(t('team.settings.errorCanceling'));
    } finally {
      setIsRemoving(null);
    }
  };

  // Close confirm modal
  const closeConfirmModal = () => {
    if (isRemoving) return; // Don't close while action is in progress
    setConfirmModal({ isOpen: false, type: 'remove' });
  };

  // Refresh after invite (don't close modal - let user see the invite link first)
  // Use silent=true to avoid unmounting the modal with loading spinner
  const handleInviteSuccess = () => {
    loadTeamMembers(true);
  };

  // Refresh after edit
  const handleEditSuccess = () => {
    setEditingMember(null);
    loadTeamMembers();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#1F1F1F] flex items-center justify-center mx-auto mb-4">
            <Loader2 size={24} className="text-white animate-spin" />
          </div>
          <p className="text-[#A0A0A0] font-medium">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#1F1F1F] flex items-center justify-center">
            <Users size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#FAFAFA]">
              {t('team.settings.title')}
            </h2>
            <p className="text-sm text-[#666666] mt-0.5">
              {t('team.settings.subtitle')}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-xl font-medium hover:bg-[#E0E0E0] active:scale-[0.98] transition-all"
        >
          <UserPlus size={18} />
          {t('team.settings.inviteButton')}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl text-[#EF4444] flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#EF4444]/10 flex items-center justify-center shrink-0">
            <AlertCircle size={16} className="text-[#EF4444]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[#EF4444]">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-sm text-[#EF4444] hover:text-[#EF4444] mt-1 font-medium"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      )}

      {/* Team Members List */}
      <div className="border border-[#1F1F1F] rounded-xl overflow-hidden bg-[#0A0A0A]">
        {teamMembers.length === 0 && pendingInvites.length === 0 ? (
          <div className="py-16 px-8">
            <div className="max-w-sm mx-auto text-center">
              {/* Decorative Icon */}
              <div className="relative inline-flex mb-6">
                <div className="w-20 h-20 rounded-2xl bg-[#1F1F1F] flex items-center justify-center border border-[#1F1F1F]/50">
                  <Users size={36} className="text-[#666666]" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg bg-[#1F1F1F] flex items-center justify-center border-2 border-white">
                  <UserPlus size={14} className="text-[#FAFAFA]" />
                </div>
              </div>

              <h3 className="text-lg font-semibold text-[#FAFAFA] mb-2">
                {t('team.settings.emptyTitle')}
              </h3>
              <p className="text-[#666666] text-sm leading-relaxed mb-6">
                {t('team.settings.emptyMessage')}
              </p>
              <button
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center gap-2 text-[#FAFAFA] font-medium hover:text-[#A0A0A0] transition-colors group"
              >
                <span>{t('team.settings.inviteFirstMember')}</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#1F1F1F]">
            {/* Active Team Members */}
            {teamMembers.map((member) => (
              <TeamMemberRow
                key={member.id}
                member={member}
                onEdit={() => setEditingMember(member)}
                onRemove={() => handleRemove(member)}
                isRemoving={isRemoving === member.id}
                t={t}
              />
            ))}

            {/* Pending Invitations */}
            {pendingInvites.map((invite) => (
              <PendingInviteRow
                key={invite.id}
                invite={invite}
                onCancel={() => handleCancelInvite(invite)}
                isRemoving={isRemoving === invite.id}
                t={t}
              />
            ))}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && selectedCommunity && (
        <InviteTeamMemberModal
          communityId={selectedCommunity.id}
          onClose={() => setShowInviteModal(false)}
          onSuccess={handleInviteSuccess}
        />
      )}

      {/* Edit Modal */}
      {editingMember && (
        <EditTeamMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSuccess={handleEditSuccess}
          onDelete={() => {
            handleRemove(editingMember);
            setEditingMember(null);
          }}
        />
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.type === 'remove' ? handleConfirmRemove : handleConfirmCancelInvite}
        title={
          confirmModal.type === 'remove'
            ? t('team.settings.confirmRemoveTitle')
            : t('team.settings.confirmCancelInviteTitle')
        }
        message={
          confirmModal.type === 'remove'
            ? t('team.settings.confirmRemove', {
                name: confirmModal.member?.profile?.full_name || confirmModal.member?.invited_email || '',
              })
            : t('team.settings.confirmCancelInvite', {
                email: confirmModal.invite?.invited_email || '',
              })
        }
        confirmLabel={
          confirmModal.type === 'remove'
            ? t('team.settings.removeButton')
            : t('team.settings.cancelInviteButton')
        }
        isLoading={!!isRemoving}
        variant={confirmModal.type === 'remove' ? 'danger' : 'warning'}
      />
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface TeamMemberRowProps {
  member: TeamMemberWithProfile;
  onEdit: () => void;
  onRemove: () => void;
  isRemoving: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}

const TeamMemberRow: React.FC<TeamMemberRowProps> = ({
  member,
  onEdit,
  onRemove,
  isRemoving,
  t,
}) => {
  const badgeType = getBadgeType(member.role);

  return (
    <div className="px-5 py-4 flex items-center gap-4 hover:bg-[#0A0A0A]/80 transition-colors group">
      {/* Avatar */}
      <div className="relative">
        <Avatar
          src={member.profile?.avatar_url}
          alt={member.profile?.full_name || ''}
          size="md"
        />
        {member.is_messageable && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#22C55E] border-2 border-white flex items-center justify-center">
            <MessageSquare size={8} className="text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[#FAFAFA] truncate">
            {member.profile?.full_name || t('team.settings.unknownUser')}
          </span>
          <TeamBadge type={badgeType} t={t} />
        </div>
        <div className="flex items-center gap-2 text-sm text-[#666666] mt-0.5">
          <span className="text-[#FAFAFA] font-medium">
            {t(`team.roles.${member.role}`)}
          </span>
          <span className="text-[#A0A0A0]">•</span>
          <span className="truncate">{member.profile?.email}</span>
        </div>
        {member.title && (
          <p className="text-sm text-[#A0A0A0] mt-1 truncate">{member.title}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="p-2.5 text-[#666666] hover:text-[#FAFAFA] hover:bg-[#151515] rounded-xl transition-all"
          title={t('common.edit')}
        >
          <Settings size={18} />
        </button>
        <button
          onClick={onRemove}
          disabled={isRemoving}
          className="p-2.5 text-[#666666] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded-xl transition-all disabled:opacity-50"
          title={t('common.delete')}
        >
          {isRemoving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <X size={18} />
          )}
        </button>
      </div>
    </div>
  );
};

interface PendingInviteRowProps {
  invite: DbCommunityTeamMember;
  onCancel: () => void;
  isRemoving: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}

const PendingInviteRow: React.FC<PendingInviteRowProps> = ({
  invite,
  onCancel,
  isRemoving,
  t,
}) => {
  const [copied, setCopied] = useState(false);
  const badgeType = getBadgeType(invite.role);

  // Calculate expiration
  const getExpirationInfo = () => {
    if (!invite.invite_expires_at) return null;
    const expiresAt = new Date(invite.invite_expires_at);
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return { text: t('team.settings.expired'), color: 'text-[#EF4444]', bgColor: 'bg-[#EF4444]/10' };
    } else if (diffDays === 1) {
      return { text: t('team.settings.expiresIn', { count: 1 }), color: 'text-[#EF4444]', bgColor: 'bg-[#EF4444]/10' };
    } else if (diffDays <= 3) {
      return { text: t('team.settings.expiresIn', { count: diffDays }), color: 'text-[#EAB308]', bgColor: 'bg-[#EAB308]/10' };
    } else {
      return { text: t('team.settings.expiresIn', { count: diffDays }), color: 'text-[#22C55E]', bgColor: 'bg-[#22C55E]/10' };
    }
  };

  const expirationInfo = getExpirationInfo();

  // Generate invite link
  const inviteLink = invite.invite_token
    ? `${window.location.origin}/invite/team/${invite.invite_token}`
    : null;

  // Copy invite link
  const handleCopyLink = async () => {
    if (inviteLink) {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="px-5 py-4 bg-[#EAB308]/5 border-l-4 border-[#EAB308]">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-[#EAB308] flex items-center justify-center shrink-0">
          <Link size={20} className="text-white" />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Header Row: Role + Badge + Status */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-[#FAFAFA]">
              {t(`team.roles.${invite.role}`)}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-md ${
              badgeType === 'team'
                ? 'bg-[#1F1F1F] text-[#A0A0A0]'
                : 'bg-[#22C55E]/10 text-[#22C55E]'
            }`}>
              {t(`team.badges.${badgeType}`)}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#EAB308]/10 text-[#EAB308] text-xs font-semibold rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EAB308] animate-pulse" />
              {t('team.settings.pendingInvite')}
            </span>
          </div>

          {/* Title if provided */}
          {invite.title && (
            <div className="flex items-center gap-1.5 text-sm text-[#A0A0A0] mb-1">
              <Briefcase size={14} className="text-[#666666]" />
              <span>{invite.title}</span>
            </div>
          )}

          {/* Bio preview if provided */}
          {invite.bio && (
            <p className="text-sm text-[#666666] line-clamp-1 mb-2">
              {invite.bio}
            </p>
          )}

          {/* Invite Link Section */}
          {inviteLink && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 bg-[#0A0A0A]/80 border border-[#1F1F1F] rounded-lg">
                <Link size={14} className="text-[#666666] shrink-0" />
                <span className="text-xs text-[#A0A0A0] truncate font-mono">
                  {inviteLink}
                </span>
              </div>
              <button
                onClick={handleCopyLink}
                className={`shrink-0 px-3 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all ${
                  copied
                    ? 'bg-[#22C55E]/10 text-[#22C55E]'
                    : 'bg-white text-black hover:bg-[#E0E0E0] active:scale-[0.98]'
                }`}
              >
                {copied ? (
                  <>
                    <Check size={14} />
                    {t('team.settings.copied')}
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    {t('team.settings.copyLink')}
                  </>
                )}
              </button>
            </div>
          )}

          {/* Footer: Expiration + DM status */}
          <div className="flex items-center gap-3 mt-2 text-xs">
            {expirationInfo && (
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${expirationInfo.bgColor} ${expirationInfo.color}`}>
                <Clock size={12} />
                {expirationInfo.text}
              </span>
            )}
            {invite.is_messageable && (
              <span className="inline-flex items-center gap-1 text-[#666666]">
                <MessageSquare size={12} />
                {t('team.settings.canReceiveDMs')}
              </span>
            )}
          </div>
        </div>

        {/* Cancel Button */}
        <button
          onClick={onCancel}
          disabled={isRemoving}
          className="shrink-0 p-2.5 text-[#666666] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded-xl transition-all disabled:opacity-50"
          title={t('team.settings.cancelInvite')}
        >
          {isRemoving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <X size={18} />
          )}
        </button>
      </div>
    </div>
  );
};

interface TeamBadgeProps {
  type: 'team' | 'guest';
  t: (key: string) => string;
}

const TeamBadge: React.FC<TeamBadgeProps> = ({ type, t }) => {
  const config = {
    team: {
      bg: 'bg-[#151515]',
      border: 'border-[#1F1F1F]',
      text: 'text-[#A0A0A0]',
      label: t('team.badges.team'),
    },
    guest: {
      bg: 'bg-[#22C55E]/10',
      border: 'border-[#22C55E]/20',
      text: 'text-[#22C55E]',
      label: t('team.badges.guest'),
    },
  };

  const { bg, border, text, label } = config[type];

  return (
    <span className={`px-2 py-0.5 ${bg} ${text} text-xs font-semibold rounded-md border ${border}`}>
      {label}
    </span>
  );
};

export default TeamSettingsTab;
