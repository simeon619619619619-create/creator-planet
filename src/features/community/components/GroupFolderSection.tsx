// ============================================================================
// GROUP FOLDER SECTION COMPONENT
// Collapsible folder in sidebar showing channels for a group
// ============================================================================

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Edit3,
  Trash2,
  Plus,
} from 'lucide-react';
import type {
  DbCommunityChannel,
  DbCommunityGroup,
} from '../../../core/supabase/database.types';

interface GroupFolderSectionProps {
  group?: DbCommunityGroup; // undefined = global section
  channels: DbCommunityChannel[];
  selectedChannelId: string | null;
  isOwner: boolean;
  memberCount?: number;
  unreadChannelIds?: Set<string>; // Channels with unread posts
  onSelectChannel: (channel: DbCommunityChannel) => void;
  onEditChannel: (channel: DbCommunityChannel) => void;
  onDeleteChannel: (channelId: string) => void;
  onAddChannel?: () => void;
}

const GroupFolderSection: React.FC<GroupFolderSectionProps> = ({
  group,
  channels,
  selectedChannelId,
  isOwner,
  memberCount,
  unreadChannelIds,
  onSelectChannel,
  onEditChannel,
  onDeleteChannel,
  onAddChannel,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  const [showChannelMenu, setShowChannelMenu] = useState<string | null>(null);

  const sectionName = group?.name || t('communityHub.folders.general');
  const isGlobal = !group;

  return (
    <div className="mb-2">
      {/* Section Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="group w-full flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 uppercase tracking-wider"
      >
        {isExpanded ? (
          <ChevronDown size={14} />
        ) : (
          <ChevronRight size={14} />
        )}
        <span className="flex-1 text-left">{sectionName}</span>
        {memberCount !== undefined && !isGlobal && (
          <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-normal normal-case">
            {memberCount}
          </span>
        )}
        {isOwner && onAddChannel && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onAddChannel();
            }}
            className="p-0.5 hover:bg-slate-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Plus size={12} />
          </span>
        )}
      </button>

      {/* Channels */}
      {isExpanded && (
        <div className="space-y-0.5 mt-0.5">
          {channels.map((channel) => (
            <div
              key={channel.id}
              className={`group relative flex items-center rounded-lg transition-colors
                ${selectedChannelId === channel.id ? 'bg-indigo-50' : 'hover:bg-slate-50'}
              `}
            >
              <button
                onClick={() => onSelectChannel(channel)}
                className={`flex-1 text-left px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-2
                  ${selectedChannelId === channel.id ? 'text-indigo-700' : 'text-slate-600'}
                `}
              >
                <span># {channel.name.toLowerCase().replace(/ /g, '-')}</span>
                {unreadChannelIds?.has(channel.id) && selectedChannelId !== channel.id && (
                  <span className="w-2 h-2 bg-indigo-500 rounded-full shrink-0" />
                )}
              </button>
              {isOwner && (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowChannelMenu(
                        showChannelMenu === channel.id ? null : channel.id
                      );
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 transition-all"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {showChannelMenu === channel.id && (
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20 min-w-[100px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowChannelMenu(null);
                          onEditChannel(channel);
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Edit3 size={12} />
                        {t('communityHub.folders.contextMenu.edit')}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowChannelMenu(null);
                          onDeleteChannel(channel.id);
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 size={12} />
                        {t('communityHub.folders.contextMenu.delete')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {channels.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-400 italic">
              {t('communityHub.folders.emptyChannels')}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default GroupFolderSection;
