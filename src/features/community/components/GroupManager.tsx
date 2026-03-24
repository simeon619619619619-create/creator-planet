// ============================================================================
// GROUP MANAGER COMPONENT
// Allows creators to create, edit, delete, and reorder member groups
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Plus,
  Edit3,
  Trash2,
  GripVertical,
  Loader2,
  X,
  ChevronRight,
} from 'lucide-react';
import {
  getGroupsWithCounts,
  createGroup,
  updateGroup,
  deleteGroup,
} from '../groupService';
import type { DbCommunityGroupWithCount } from '../../../core/supabase/database.types';

interface GroupManagerProps {
  communityId: string;
  onSelectGroup: (groupId: string) => void;
  onClose: () => void;
}

const GroupManager: React.FC<GroupManagerProps> = ({
  communityId,
  onSelectGroup,
  onClose,
}) => {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<DbCommunityGroupWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<DbCommunityGroupWithCount | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadGroups();
  }, [communityId]);

  const loadGroups = async () => {
    setIsLoading(true);
    const data = await getGroupsWithCounts(communityId);
    setGroups(data);
    setIsLoading(false);
  };

  const handleAddGroup = async () => {
    if (!newGroupName.trim() || isSaving) return;

    setIsSaving(true);
    const result = await createGroup(
      communityId,
      newGroupName.trim(),
      newGroupDescription.trim() || undefined
    );

    if (result) {
      setNewGroupName('');
      setNewGroupDescription('');
      setShowAddForm(false);
      await loadGroups();
    }
    setIsSaving(false);
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup || !newGroupName.trim() || isSaving) return;

    setIsSaving(true);
    const result = await updateGroup(editingGroup.id, {
      name: newGroupName.trim(),
      description: newGroupDescription.trim() || null,
    });

    if (result) {
      setEditingGroup(null);
      setNewGroupName('');
      setNewGroupDescription('');
      await loadGroups();
    }
    setIsSaving(false);
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm(t('communityHub.groups.deleteConfirm'))) {
      return;
    }

    const success = await deleteGroup(groupId);
    if (success) {
      await loadGroups();
    }
  };

  const startEdit = (group: DbCommunityGroupWithCount) => {
    setEditingGroup(group);
    setNewGroupName(group.name);
    setNewGroupDescription(group.description || '');
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingGroup(null);
    setNewGroupName('');
    setNewGroupDescription('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--fc-section-text,#FAFAFA)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--fc-section-text,#FAFAFA)]">{t('communityHub.groups.title')}</h3>
        <button
          onClick={onClose}
          className="p-1 text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-section-text,#FAFAFA)]"
        >
          <X size={20} />
        </button>
      </div>

      <p className="text-sm text-[var(--fc-section-muted,#A0A0A0)]">
        {t('communityHub.groups.description')}
      </p>

      {/* Groups List */}
      <div className="space-y-2">
        {groups.map((group) => (
          <div
            key={group.id}
            className="flex items-center gap-3 p-3 bg-[var(--fc-section-hover,#151515)] rounded-lg group"
          >
            <GripVertical size={16} className="text-[var(--fc-section-muted,#666666)] cursor-grab" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[var(--fc-section-text,#FAFAFA)]">{group.name}</span>
                <span className="text-xs text-[var(--fc-section-muted,#A0A0A0)] bg-[var(--fc-section-hover,#1F1F1F)] px-2 py-0.5 rounded-full">
                  {group.member_count === 1 ? t('communityHub.groups.memberCount', { count: group.member_count }) : t('communityHub.groups.memberCountPlural', { count: group.member_count })}
                </span>
              </div>
              {group.description && (
                <p className="text-sm text-[var(--fc-section-muted,#A0A0A0)] truncate">{group.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onSelectGroup(group.id)}
                className="p-1.5 text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-section-text,#FAFAFA)] hover:bg-[var(--fc-section-hover,#151515)] rounded"
                title={t('communityHub.groups.tooltip.manageMembers')}
              >
                <Users size={16} />
              </button>
              <button
                onClick={() => startEdit(group)}
                className="p-1.5 text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-section-text,#FAFAFA)] hover:bg-[var(--fc-section-hover,#151515)] rounded"
                title={t('communityHub.groups.tooltip.editGroup')}
              >
                <Edit3 size={16} />
              </button>
              <button
                onClick={() => handleDeleteGroup(group.id)}
                className="p-1.5 text-[var(--fc-section-muted,#666666)] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded"
                title={t('communityHub.groups.tooltip.deleteGroup')}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <ChevronRight size={16} className="text-[var(--fc-section-muted,#666666)]" />
          </div>
        ))}

        {groups.length === 0 && !showAddForm && (
          <p className="text-sm text-[var(--fc-section-muted,#A0A0A0)] text-center py-4">
            {t('communityHub.groups.emptyState')}
          </p>
        )}
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingGroup) && (
        <div className="p-4 bg-[var(--fc-section-hover,#151515)] rounded-lg border border-[var(--fc-section-border,#1F1F1F)] space-y-3">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder={t('communityHub.groups.form.namePlaceholder')}
            className="w-full px-3 py-2 border border-[var(--fc-section-border,#1F1F1F)] rounded-lg text-sm focus:ring-1 focus:ring-white/10 focus:border-[var(--fc-section-text,#555555)]"
            autoFocus
          />
          <input
            type="text"
            value={newGroupDescription}
            onChange={(e) => setNewGroupDescription(e.target.value)}
            placeholder={t('communityHub.groups.form.descriptionPlaceholder')}
            className="w-full px-3 py-2 border border-[var(--fc-section-border,#1F1F1F)] rounded-lg text-sm focus:ring-1 focus:ring-white/10 focus:border-[var(--fc-section-text,#555555)]"
          />
          <div className="flex gap-2">
            <button
              onClick={editingGroup ? handleUpdateGroup : handleAddGroup}
              disabled={!newGroupName.trim() || isSaving}
              className="flex-1 px-4 py-2 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] rounded-lg text-sm font-medium hover:bg-[#E0E0E0] disabled:bg-[#333333] disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin mx-auto" />
              ) : editingGroup ? (
                t('communityHub.groups.form.saveChanges')
              ) : (
                t('communityHub.groups.form.createGroup')
              )}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                cancelEdit();
              }}
              className="px-4 py-2 bg-[var(--fc-section-hover,#1F1F1F)] text-[var(--fc-section-muted,#A0A0A0)] rounded-lg text-sm font-medium hover:bg-[#333333]"
            >
              {t('communityHub.groups.form.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Add Button */}
      {!showAddForm && !editingGroup && (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full py-2 px-4 border-2 border-dashed border-[var(--fc-section-border,#1F1F1F)] rounded-lg text-[var(--fc-section-muted,#A0A0A0)] hover:border-[#333333] hover:text-[var(--fc-section-text,#FAFAFA)] flex items-center justify-center gap-2 transition-colors"
        >
          <Plus size={18} />
          {t('communityHub.groups.addGroup')}
        </button>
      )}
    </div>
  );
};

export default GroupManager;
