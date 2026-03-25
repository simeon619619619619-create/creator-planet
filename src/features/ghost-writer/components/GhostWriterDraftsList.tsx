import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, FileText, Loader2 } from 'lucide-react';
import { getPendingDrafts, approveDraft, rejectDraft } from '../ghostWriterService';
import type { DbGhostWriterDraft } from '../ghostWriterTypes';

interface GhostWriterDraftsListProps {
  communityId: string;
  creatorProfileId: string;
  onDraftPublished?: () => void;
}

const GhostWriterDraftsList: React.FC<GhostWriterDraftsListProps> = ({
  communityId,
  creatorProfileId,
  onDraftPublished,
}) => {
  const { t } = useTranslation();
  const [drafts, setDrafts] = useState<DbGhostWriterDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    setIsLoading(true);
    const result = await getPendingDrafts(communityId);
    setDrafts(result);
    setIsLoading(false);
  }, [communityId]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const handleApprove = async (draftId: string) => {
    setActionInProgress(draftId);
    await approveDraft(draftId, creatorProfileId);
    await loadDrafts();
    setActionInProgress(null);
    onDraftPublished?.();
  };

  const handleReject = async (draftId: string) => {
    setActionInProgress(draftId);
    await rejectDraft(draftId);
    await loadDrafts();
    setActionInProgress(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 size={18} className="animate-spin text-[var(--fc-section-muted,#666666)]" />
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="text-center py-6">
        <FileText size={24} className="mx-auto mb-2 text-[var(--fc-section-muted,#666666)]" />
        <p className="text-sm text-[var(--fc-section-muted,#666666)]">
          {t('ghostWriter.drafts.empty', { defaultValue: 'Няма чакащи публикации' })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-[var(--fc-section-muted,#A0A0A0)] uppercase tracking-wider px-1">
        {t('ghostWriter.drafts.title', { defaultValue: 'Чакащи публикации' })} ({drafts.length})
      </h4>
      {drafts.map((draft) => (
        <div
          key={draft.id}
          className="p-3 bg-[var(--fc-section-hover,#151515)] border border-[var(--fc-section-border,#1F1F1F)] rounded-lg"
        >
          <p className="text-sm text-[var(--fc-section-text,#FAFAFA)] line-clamp-3 mb-2">
            {draft.content.slice(0, 150)}
            {draft.content.length > 150 ? '...' : ''}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--fc-section-muted,#666666)]">
              {new Date(draft.created_at).toLocaleDateString('bg-BG')}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleApprove(draft.id)}
                disabled={actionInProgress === draft.id}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[#22C55E]/10 text-[#22C55E] hover:bg-[#22C55E]/20 transition-colors disabled:opacity-50"
              >
                {actionInProgress === draft.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Check size={12} />
                )}
                {t('ghostWriter.drafts.approve', { defaultValue: 'Одобри' })}
              </button>
              <button
                onClick={() => handleReject(draft.id)}
                disabled={actionInProgress === draft.id}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20 transition-colors disabled:opacity-50"
              >
                <X size={12} />
                {t('ghostWriter.drafts.reject', { defaultValue: 'Отхвърли' })}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GhostWriterDraftsList;
