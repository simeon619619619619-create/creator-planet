// ============================================================================
// INVITE TEAM MEMBER MODAL
// Modal for creating invite links for new team members
// ============================================================================

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  UserPlus,
  Briefcase,
  FileText,
  MessageSquare,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Link,
} from 'lucide-react';
import { createInviteLink } from '../teamService';
import type { TeamMemberRole } from '../dmTypes';
import { TEAM_ROLE_CONFIGS } from '../dmTypes';

interface InviteTeamMemberModalProps {
  communityId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const InviteTeamMemberModal: React.FC<InviteTeamMemberModalProps> = ({
  communityId,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();

  // Form state
  const [role, setRole] = useState<TeamMemberRole>('lecturer');
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [canReceiveDMs, setCanReceiveDMs] = useState(true);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Copy invite link to clipboard
  const handleCopyLink = async () => {
    if (inviteLink) {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Handle form submission - create invite link
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await createInviteLink(communityId, {
        role,
        title: title.trim() || undefined,
        bio: bio.trim() || undefined,
        is_messageable: canReceiveDMs,
      });

      if (result.success && result.inviteLink) {
        setInviteLink(result.inviteLink);
        // Call onSuccess to refresh the team list
        onSuccess();
      } else {
        setError(result.error || t('team.invite.errorFailed'));
      }
    } catch (err) {
      console.error('Error creating invite link:', err);
      setError(t('team.invite.errorFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0A0A0A] rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header - only show if not in success state */}
        {!inviteLink && (
          <div className="flex items-center justify-between p-4 border-b border-[#1F1F1F]">
            <div className="flex items-center gap-2">
              <UserPlus size={20} className="text-[#FAFAFA]" />
              <h3 className="text-lg font-semibold text-[#FAFAFA]">
                {t('team.invite.title')}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-[#1F1F1F] rounded-lg transition-colors"
            >
              <X size={20} className="text-[#666666]" />
            </button>
          </div>
        )}

        {/* Success state with invite link */}
        {inviteLink ? (
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-[#22C55E]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-[#22C55E]" />
            </div>
            <h3 className="text-lg font-semibold text-[#FAFAFA] mb-2">
              {t('team.invite.success.title')}
            </h3>
            <p className="text-sm text-[#A0A0A0] mb-6">
              {t('team.invite.success.description')}
            </p>

            {/* Invite Link Box */}
            <div className="bg-[#0A0A0A] rounded-lg p-4 mb-4">
              <p className="text-xs text-[#666666] mb-2">{t('team.invite.success.linkLabel')}</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  className="flex-1 px-3 py-2 text-sm bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg text-[#A0A0A0] truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] text-sm font-medium rounded-lg hover:bg-[#E0E0E0] transition-colors flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      {t('team.invite.success.copied')}
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      {t('team.invite.success.copy')}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Expiration notice */}
            <p className="text-xs text-[#666666] mb-6">
              {t('team.invite.success.expiresIn', { days: 7 })}
            </p>

            {/* Done button */}
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-[#1F1F1F] text-[#A0A0A0] text-sm font-medium rounded-lg hover:bg-[#151515] transition-colors"
            >
              {t('team.invite.success.done')}
            </button>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
            {/* Error Message */}
            {error && (
              <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg flex items-start gap-2">
                <AlertCircle size={18} className="text-[#EF4444] shrink-0 mt-0.5" />
                <p className="text-sm text-[#EF4444]">{error}</p>
              </div>
            )}

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-[#A0A0A0] mb-2">
                {t('team.invite.roleLabel')}
              </label>
              <div className="space-y-2">
                {TEAM_ROLE_CONFIGS.map((config) => (
                  <label
                    key={config.key}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                      role === config.key
                        ? 'border-[#333333] bg-[#151515]'
                        : 'border-[#1F1F1F] hover:border-[#1F1F1F]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={config.key}
                      checked={role === config.key}
                      onChange={() => setRole(config.key)}
                      className="mt-1 text-[#FAFAFA] focus:ring-white/10"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#FAFAFA]">
                          {t(config.labelKey)}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          config.badgeType === 'team'
                            ? 'bg-[#1F1F1F] text-[#A0A0A0]'
                            : 'bg-[#22C55E]/10 text-[#22C55E]'
                        }`}>
                          {t(`team.badges.${config.badgeType}`)}
                        </span>
                      </div>
                      <p className="text-sm text-[#666666] mt-0.5">
                        {t(config.descriptionKey)}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-[#A0A0A0] mb-1">
                {t('team.invite.titleLabel')}
              </label>
              <div className="relative">
                <Briefcase size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]" />
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
                  placeholder={t('team.invite.titlePlaceholder')}
                />
              </div>
              <p className="text-xs text-[#666666] mt-1">
                {t('team.invite.titleHint')}
              </p>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-[#A0A0A0] mb-1">
                {t('team.invite.bioLabel')}
              </label>
              <div className="relative">
                <FileText size={18} className="absolute left-3 top-3 text-[#666666]" />
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555] resize-none h-20"
                  placeholder={t('team.invite.bioPlaceholder')}
                />
              </div>
            </div>

            {/* Can Receive DMs Toggle */}
            <div className="flex items-center justify-between p-3 bg-[#0A0A0A] rounded-lg">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-[#666666]" />
                <span className="text-sm font-medium text-[#A0A0A0]">
                  {t('team.invite.canReceiveDMs')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCanReceiveDMs(!canReceiveDMs)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  canReceiveDMs ? 'bg-white' : 'bg-[#1F1F1F]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-[#0A0A0A] transition-transform ${
                    canReceiveDMs ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-[#1F1F1F] rounded-lg hover:bg-[#0A0A0A] font-medium text-[#A0A0A0]"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] px-4 py-2 rounded-lg hover:bg-[#E0E0E0] disabled:opacity-50 font-medium flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {t('team.invite.creating')}
                  </>
                ) : (
                  <>
                    <Link size={18} />
                    {t('team.invite.createLink')}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default InviteTeamMemberModal;
