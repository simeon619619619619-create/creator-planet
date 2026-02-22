// ============================================================================
// EDIT TEAM MEMBER MODAL
// Modal for editing existing team member details
// ============================================================================

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Settings,
  Briefcase,
  FileText,
  MessageSquare,
  Loader2,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { updateTeamMember } from '../teamService';
import type { TeamMemberRole, TeamMemberWithProfile, UpdateTeamMemberInput } from '../dmTypes';
import { TEAM_ROLE_CONFIGS } from '../dmTypes';
import Avatar from '../../../shared/Avatar';

interface EditTeamMemberModalProps {
  member: TeamMemberWithProfile;
  onClose: () => void;
  onSuccess: () => void;
  onDelete: () => void;
}

const EditTeamMemberModal: React.FC<EditTeamMemberModalProps> = ({
  member,
  onClose,
  onSuccess,
  onDelete,
}) => {
  const { t } = useTranslation();

  // Form state (initialized from member)
  const [role, setRole] = useState<TeamMemberRole>(member.role);
  const [title, setTitle] = useState(member.title || '');
  const [bio, setBio] = useState(member.bio || '');
  const [canReceiveDMs, setCanReceiveDMs] = useState(member.is_messageable);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if form has changes
  const hasChanges =
    role !== member.role ||
    title !== (member.title || '') ||
    bio !== (member.bio || '') ||
    canReceiveDMs !== member.is_messageable;

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasChanges) {
      onClose();
      return;
    }

    setIsSubmitting(true);

    try {
      const input: UpdateTeamMemberInput = {
        role,
        title: title.trim() || undefined,
        bio: bio.trim() || undefined,
        is_messageable: canReceiveDMs,
      };

      const result = await updateTeamMember(member.id, input);

      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || t('team.edit.errorFailed'));
      }
    } catch (err) {
      console.error('Error updating team member:', err);
      setError(t('team.edit.errorFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Settings size={20} className="text-indigo-600" />
            <h3 className="text-lg font-semibold text-slate-900">
              {t('team.edit.title')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Member Info Header */}
        <div className="flex items-center gap-3 p-4 bg-slate-50 border-b border-slate-100">
          <Avatar
            src={member.profile?.avatar_url}
            alt={member.profile?.full_name || ''}
            size="md"
          />
          <div>
            <p className="font-medium text-slate-900">
              {member.profile?.full_name || t('team.settings.unknownUser')}
            </p>
            <p className="text-sm text-slate-500">
              {member.profile?.email}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t('team.edit.roleLabel')}
            </label>
            <div className="space-y-2">
              {TEAM_ROLE_CONFIGS.map((config) => (
                <label
                  key={config.key}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                    role === config.key
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={config.key}
                    checked={role === config.key}
                    onChange={() => setRole(config.key)}
                    className="mt-1 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">
                        {t(config.labelKey)}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        config.badgeType === 'team'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {t(`team.badges.${config.badgeType}`)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {t(config.descriptionKey)}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('team.edit.titleLabel')}
            </label>
            <div className="relative">
              <Briefcase size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder={t('team.edit.titlePlaceholder')}
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('team.edit.bioLabel')}
            </label>
            <div className="relative">
              <FileText size={18} className="absolute left-3 top-3 text-slate-400" />
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none h-20"
                placeholder={t('team.edit.bioPlaceholder')}
              />
            </div>
          </div>

          {/* Can Receive DMs Toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-slate-500" />
              <span className="text-sm font-medium text-slate-700">
                {t('team.edit.canReceiveDMs')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCanReceiveDMs(!canReceiveDMs)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                canReceiveDMs ? 'bg-indigo-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  canReceiveDMs ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Danger Zone */}
          <div className="pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onDelete}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-medium transition-colors"
            >
              <Trash2 size={18} />
              {t('team.edit.removeFromTeam')}
            </button>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium text-slate-700"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={!hasChanges || isSubmitting}
              className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {t('common.saving')}
                </>
              ) : (
                t('common.save')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTeamMemberModal;
