// ============================================================================
// GROUP MEMBER ASSIGNER COMPONENT
// Allows creators to assign/remove members from a specific group
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Search,
  Check,
  Loader2,
  Users,
} from 'lucide-react';
import {
  getCommunityMembersWithGroups,
  setGroupMembers,
  getGroupsWithCounts,
} from '../groupService';
import type { DbProfile, DbCommunityGroup } from '../../../core/supabase/database.types';
import { useAuth } from '../../../core/contexts/AuthContext';

interface GroupMemberAssignerProps {
  communityId: string;
  groupId: string;
  onBack: () => void;
}

interface MemberWithGroups extends DbProfile {
  group_ids: string[];
}

const GroupMemberAssigner: React.FC<GroupMemberAssignerProps> = ({
  communityId,
  groupId,
  onBack,
}) => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [group, setGroup] = useState<DbCommunityGroup | null>(null);
  const [members, setMembers] = useState<MemberWithGroups[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadData();
  }, [communityId, groupId]);

  const loadData = async () => {
    setIsLoading(true);

    // Load group info
    const groups = await getGroupsWithCounts(communityId);
    const currentGroup = groups.find((g) => g.id === groupId);
    setGroup(currentGroup || null);

    // Load all community members with their group assignments
    const allMembers = await getCommunityMembersWithGroups(communityId);
    setMembers(allMembers);

    // Pre-select members already in this group
    const initialSelected = new Set(
      allMembers
        .filter((m) => m.group_ids.includes(groupId))
        .map((m) => m.id)
    );
    setSelectedIds(initialSelected);

    setIsLoading(false);
  };

  const toggleMember = (memberId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedIds(newSelected);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!profile?.id || isSaving) return;

    setIsSaving(true);
    const success = await setGroupMembers(
      groupId,
      Array.from(selectedIds),
      profile.id
    );

    if (success) {
      setHasChanges(false);
      onBack();
    }
    setIsSaving(false);
  };

  const filteredMembers = members.filter((m) =>
    (m.full_name || m.email || '')
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {group?.name ? t('communityHub.memberAssigner.title', { groupName: group.name }) : t('communityHub.memberAssigner.fallbackTitle')}
          </h3>
          <p className="text-sm text-slate-500">
            {selectedIds.size === 1 ? t('communityHub.memberAssigner.selectedCount', { count: selectedIds.size }) : t('communityHub.memberAssigner.selectedCountPlural', { count: selectedIds.size })}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('communityHub.memberAssigner.searchPlaceholder')}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Members List */}
      <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
        {filteredMembers.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-500">
            {searchQuery ? t('communityHub.memberAssigner.emptySearch') : t('communityHub.memberAssigner.emptyCommunity')}
          </div>
        ) : (
          filteredMembers.map((member) => (
            <label
              key={member.id}
              className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(member.id)}
                onChange={() => toggleMember(member.id)}
                className="sr-only"
              />
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  selectedIds.has(member.id)
                    ? 'bg-indigo-600 border-indigo-600'
                    : 'border-slate-300'
                }`}
              >
                {selectedIds.has(member.id) && (
                  <Check size={14} className="text-white" />
                )}
              </div>
              <img
                src={
                  member.avatar_url ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    member.full_name || 'User'
                  )}&background=6366f1&color=fff`
                }
                alt={member.full_name || 'User'}
                className="w-8 h-8 rounded-full object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">
                  {member.full_name || t('communityHub.memberAssigner.unknownMember')}
                </p>
                <p className="text-xs text-slate-500 truncate">{member.email}</p>
              </div>
              {member.group_ids.length > 0 && (
                <span className="text-xs text-slate-400">
                  {member.group_ids.length === 1 ? t('communityHub.memberAssigner.groupCount', { count: member.group_ids.length }) : t('communityHub.memberAssigner.groupCountPlural', { count: member.group_ids.length })}
                </span>
              )}
            </label>
          ))
        )}
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={!hasChanges || isSaving}
        className="w-full py-2.5 px-4 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isSaving ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            {t('communityHub.memberAssigner.saving')}
          </>
        ) : (
          <>
            <Users size={16} />
            {t('communityHub.memberAssigner.saveMembers')}
          </>
        )}
      </button>
    </div>
  );
};

export default GroupMemberAssigner;
