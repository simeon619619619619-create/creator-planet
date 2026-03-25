import React from 'react';
import { useTranslation } from 'react-i18next';
import { Power, MessageSquare, Eye, Zap } from 'lucide-react';
import type { DbGhostWriterConfig, GhostWriterApprovalMode } from '../ghostWriterTypes';

interface GhostWriterStatusPanelProps {
  config: DbGhostWriterConfig | null;
  onToggleActive: (isActive: boolean) => void;
  onToggleAutoReply: (enabled: boolean) => void;
  onChangeApprovalMode: (mode: GhostWriterApprovalMode) => void;
  draftsCount: number;
}

const GhostWriterStatusPanel: React.FC<GhostWriterStatusPanelProps> = ({
  config,
  onToggleActive,
  onToggleAutoReply,
  onChangeApprovalMode,
  draftsCount,
}) => {
  const { t } = useTranslation();

  if (!config) return null;

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-[var(--fc-section-hover,#151515)] border border-[var(--fc-section-border,#1F1F1F)] rounded-xl flex-wrap">
      {/* Master toggle */}
      <div className="flex items-center gap-2">
        <Power size={14} className="text-[var(--fc-section-muted,#A0A0A0)]" />
        <span className="text-xs font-medium text-[var(--fc-section-muted,#A0A0A0)]">
          {t('ghostWriter.statusPanel.aiAuthor', { defaultValue: 'AI Автор' })}
        </span>
        <button
          onClick={() => onToggleActive(!config.is_active)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            config.is_active ? 'bg-[#22C55E]' : 'bg-[var(--fc-section-border,#1F1F1F)]'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              config.is_active ? 'translate-x-[18px]' : 'translate-x-[3px]'
            }`}
          />
        </button>
      </div>

      <div className="w-px h-5 bg-[var(--fc-section-border,#1F1F1F)]" />

      {/* Auto-reply toggle */}
      <div className="flex items-center gap-2">
        <MessageSquare size={14} className="text-[var(--fc-section-muted,#A0A0A0)]" />
        <span className="text-xs font-medium text-[var(--fc-section-muted,#A0A0A0)]">
          {t('ghostWriter.statusPanel.autoReply', { defaultValue: 'Авто-отговор' })}
        </span>
        <button
          onClick={() => onToggleAutoReply(!config.auto_reply_enabled)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            config.auto_reply_enabled ? 'bg-[#22C55E]' : 'bg-[var(--fc-section-border,#1F1F1F)]'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              config.auto_reply_enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
            }`}
          />
        </button>
      </div>

      <div className="w-px h-5 bg-[var(--fc-section-border,#1F1F1F)]" />

      {/* Approval mode */}
      <div className="flex items-center gap-1.5">
        <div className="flex bg-[var(--fc-section,#0A0A0A)] rounded-lg p-0.5">
          <button
            onClick={() => onChangeApprovalMode('preview')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              config.approval_mode === 'preview'
                ? 'bg-[var(--fc-section-hover,#1F1F1F)] text-[var(--fc-section-text,#FAFAFA)]'
                : 'text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-section-muted,#A0A0A0)]'
            }`}
          >
            <Eye size={12} />
            {t('ghostWriter.statusPanel.preview', { defaultValue: 'Преглед' })}
          </button>
          <button
            onClick={() => onChangeApprovalMode('auto')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              config.approval_mode === 'auto'
                ? 'bg-[var(--fc-section-hover,#1F1F1F)] text-[var(--fc-section-text,#FAFAFA)]'
                : 'text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-section-muted,#A0A0A0)]'
            }`}
          >
            <Zap size={12} />
            {t('ghostWriter.statusPanel.auto', { defaultValue: 'Автоматично' })}
          </button>
        </div>
      </div>

      <div className="w-px h-5 bg-[var(--fc-section-border,#1F1F1F)]" />

      {/* Stats */}
      <span className="text-xs text-[var(--fc-section-muted,#A0A0A0)]">
        {t('ghostWriter.statusPanel.pendingDrafts', {
          defaultValue: '{{count}} чакащи',
          count: draftsCount,
        })}
      </span>
    </div>
  );
};

export default GhostWriterStatusPanel;
