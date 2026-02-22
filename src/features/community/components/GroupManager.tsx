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
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">{t('communityHub.groups.title')}</h3>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-600"
        >
          <X size={20} />
        </button>
      </div>

      <p className="text-sm text-slate-500">
        {t('communityHub.groups.description')}
      </p>

      {/* Groups List */}
      <div className="space-y-2">
        {groups.map((group) => (
          <div
            key={group.id}
            className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg group"
          >
            <GripVertical size={16} className="text-slate-300 cursor-grab" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">{group.name}</span>
                <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                  {group.member_count === 1 ? t('communityHub.groups.memberCount', { count: group.member_count }) : t('communityHub.groups.memberCountPlural', { count: group.member_count })}
                </span>
              </div>
              {group.description && (
                <p className="text-sm text-slate-500 truncate">{group.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onSelectGroup(group.id)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                title={t('communityHub.groups.tooltip.manageMembers')}
              >
                <Users size={16} />
              </button>
              <button
                onClick={() => startEdit(group)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                title={t('communityHub.groups.tooltip.editGroup')}
              >
                <Edit3 size={16} />
              </button>
              <button
                onClick={() => handleDeleteGroup(group.id)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                title={t('communityHub.groups.tooltip.deleteGroup')}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </div>
        ))}

        {groups.length === 0 && !showAddForm && (
          <p className="text-sm text-slate-500 text-center py-4">
            {t('communityHub.groups.emptyState')}
          </p>
        )}
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingGroup) && (
        <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100 space-y-3">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder={t('communityHub.groups.form.namePlaceholder')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            autoFocus
          />
          <input
            type="text"
            value={newGroupDescription}
            onChange={(e) => setNewGroupDescription(e.target.value)}
            placeholder={t('communityHub.groups.form.descriptionPlaceholder')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <div className="flex gap-2">
            <button
              onClick={editingGroup ? handleUpdateGroup : handleAddGroup}
              disabled={!newGroupName.trim() || isSaving}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
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
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300"
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
          className="w-full py-2 px-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-indigo-400 hover:text-indigo-600 flex items-center justify-center gap-2 transition-colors"
        >
          <Plus size={18} />
          {t('communityHub.groups.addGroup')}
        </button>
      )}
    </div>
  );
};

export default GroupManager;
