import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PanelLeftClose, PanelLeft, Plus, MessageSquare, Loader2, Pencil, Trash2, Check, X } from 'lucide-react';
import { getUserSessions, updateSessionTitle, deleteSession, ChatSession } from './chatbotService';

interface ChatHistorySidebarProps {
  chatbotId: string;
  userId: string;
  isOpen: boolean;
  onToggle: () => void;
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string | null) => void; // null = new chat
  onNewChat: () => void;
}

/**
 * Formats a date to a relative string like "Today", "Yesterday", or "Jan 8"
 */
function formatRelativeDate(
  dateString: string,
  t: (key: string) => string,
  locale: string
): string {
  const date = new Date(dateString);
  const now = new Date();

  // Reset times to midnight for comparison
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateDay.getTime() === today.getTime()) {
    return t('chatbots.history.date.today');
  }

  if (dateDay.getTime() === yesterday.getTime()) {
    return t('chatbots.history.date.yesterday');
  }

  // Format as "Jan 8" for other dates (localized)
  return date.toLocaleDateString(locale || 'en', { month: 'short', day: 'numeric' });
}

/**
 * Truncates a string to a maximum length with ellipsis
 */
function truncateTitle(title: string, maxLength: number = 30): string {
  if (title.length <= maxLength) return title;
  return title.slice(0, maxLength).trim() + '...';
}

const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({
  chatbotId,
  userId,
  isOpen,
  onToggle,
  selectedSessionId,
  onSelectSession,
  onNewChat,
}) => {
  const { t, i18n } = useTranslation();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const locale = i18n.resolvedLanguage || i18n.language || 'en';

  // Edit state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation state
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  // Load sessions on mount and when chatbotId/userId changes
  useEffect(() => {
    const loadSessions = async () => {
      setIsLoading(true);
      try {
        const userSessions = await getUserSessions(chatbotId, userId);
        setSessions(userSessions);
      } catch (error) {
        console.error('Error loading chat sessions:', error);
        setSessions([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (chatbotId && userId) {
      loadSessions();
    }
  }, [chatbotId, userId]);

  const handleNewChat = () => {
    onNewChat();
    onSelectSession(null);
  };

  // Start editing a session title
  const handleStartEdit = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitle(session.title || '');
    // Focus input after render
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  // Save edited title
  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingSessionId || !editTitle.trim()) return;

    try {
      await updateSessionTitle(editingSessionId, editTitle.trim());
      setSessions((prev) =>
        prev.map((s) =>
          s.id === editingSessionId ? { ...s, title: editTitle.trim() } : s
        )
      );
    } catch (error) {
      console.error('Error updating session title:', error);
    } finally {
      setEditingSessionId(null);
      setEditTitle('');
    }
  };

  // Cancel editing
  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(null);
    setEditTitle('');
  };

  // Handle key press in edit input
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit(e as unknown as React.MouseEvent);
    } else if (e.key === 'Escape') {
      handleCancelEdit(e as unknown as React.MouseEvent);
    }
  };

  // Start delete confirmation
  const handleStartDelete = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingSessionId(sessionId);
  };

  // Confirm delete
  const handleConfirmDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!deletingSessionId) return;

    try {
      const success = await deleteSession(deletingSessionId);
      if (success) {
        setSessions((prev) => prev.filter((s) => s.id !== deletingSessionId));
        // If we deleted the currently selected session, clear selection
        if (selectedSessionId === deletingSessionId) {
          onSelectSession(null);
        }
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    } finally {
      setDeletingSessionId(null);
    }
  };

  // Cancel delete
  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingSessionId(null);
  };

  return (
    <>
      {/* Toggle button when sidebar is closed */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="absolute left-2 top-2 z-10 p-2 bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-lg hover:bg-[var(--fc-section,#0A0A0A)] transition-colors sm:left-4 sm:top-4"
          aria-label={t('chatbots.history.aria.openHistory')}
        >
          <PanelLeft className="w-5 h-5 text-[var(--fc-section-muted,#A0A0A0)]" />
        </button>
      )}

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 sm:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          flex flex-col bg-[var(--fc-section,#0A0A0A)] border-r border-[var(--fc-section-border,#1F1F1F)] transition-all duration-300 ease-in-out overflow-hidden
          fixed inset-y-0 left-0 z-30 w-[280px] sm:relative sm:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0 sm:w-0'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--fc-section-border,#1F1F1F)]">
          <h2 className="text-sm font-semibold text-[var(--fc-section-text,#FAFAFA)]">{t('chatbots.history.title')}</h2>
          <button
            onClick={onToggle}
            className="p-1.5 text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-section-muted,#A0A0A0)] hover:bg-[var(--fc-section-hover,#1F1F1F)] rounded-lg transition-colors"
            aria-label={t('chatbots.history.aria.closeHistory')}
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3 border-b border-[var(--fc-section-border,#1F1F1F)]">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] text-sm font-medium rounded-lg hover:bg-[#E0E0E0] transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('chatbots.history.newChat')}
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            // Loading state
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-[var(--fc-section-text,#FAFAFA)] animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageSquare className="w-10 h-10 text-[var(--fc-section-muted,#666666)] mb-3" />
              <p className="text-sm text-[var(--fc-section-muted,#666666)]">{t('chatbots.history.emptyState.title')}</p>
              <p className="text-xs text-[var(--fc-section-muted,#666666)] mt-1">{t('chatbots.history.emptyState.subtitle')}</p>
            </div>
          ) : (
            // Sessions list
            <div className="py-2">
              {sessions.map((session) => {
                const isSelected = selectedSessionId === session.id;
                const isEditing = editingSessionId === session.id;
                const isDeleting = deletingSessionId === session.id;
                const title = session.title || t('chatbots.history.defaultTitle');
                const relativeDate = formatRelativeDate(session.created_at, t, locale);

                return (
                  <div
                    key={session.id}
                    className={`
                      group relative flex items-start gap-3 px-4 py-3 text-left transition-colors cursor-pointer
                      ${isSelected
                        ? 'bg-[var(--fc-section-hover,#1F1F1F)] border-r-2 border-white'
                        : 'hover:bg-[var(--fc-section,#0A0A0A)]'
                      }
                    `}
                    onClick={() => !isEditing && !isDeleting && onSelectSession(session.id)}
                  >
                    <MessageSquare
                      className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        isSelected ? 'text-[var(--fc-section-text,#FAFAFA)]' : 'text-[var(--fc-section-muted,#666666)]'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        // Edit mode - inline input
                        <div className="flex items-center gap-1">
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={handleEditKeyDown}
                            className="flex-1 text-sm px-2 py-1 border border-[#555555] rounded focus:outline-none focus:ring-1 focus:ring-white/10"
                            placeholder={t('chatbots.history.editPlaceholder')}
                          />
                          <button
                            onClick={handleSaveEdit}
                            className="p-1 text-[#22C55E] hover:bg-[#22C55E]/10 rounded"
                            title={t('common.save')}
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 text-[var(--fc-section-muted,#666666)] hover:bg-[var(--fc-section-hover,#1F1F1F)] rounded"
                            title={t('common.cancel')}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : isDeleting ? (
                        // Delete confirmation mode
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#EF4444] font-medium">
                            {t('chatbots.history.deleteConfirm')}
                          </span>
                          <button
                            onClick={handleConfirmDelete}
                            className="px-2 py-0.5 text-xs bg-[#EF4444] text-white rounded hover:bg-[#DC2626]"
                          >
                            {t('common.delete')}
                          </button>
                          <button
                            onClick={handleCancelDelete}
                            className="px-2 py-0.5 text-xs bg-[var(--fc-section-hover,#1F1F1F)] text-[var(--fc-section-muted,#A0A0A0)] rounded hover:bg-[#333333]"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      ) : (
                        // Normal display mode
                        <>
                          <p
                            className={`text-sm font-medium truncate ${
                              isSelected ? 'text-[var(--fc-section-text,#FAFAFA)]' : 'text-[var(--fc-section-text,#FAFAFA)]'
                            }`}
                            title={title}
                          >
                            {truncateTitle(title)}
                          </p>
                          <p
                            className={`text-xs mt-0.5 ${
                              isSelected ? 'text-[var(--fc-section-text,#FAFAFA)]' : 'text-[var(--fc-section-muted,#666666)]'
                            }`}
                          >
                            {relativeDate}
                          </p>
                        </>
                      )}
                    </div>

                    {/* Edit/Delete buttons - visible on hover */}
                    {!isEditing && !isDeleting && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleStartEdit(session, e)}
                          className="p-1.5 text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-section-text,#FAFAFA)] hover:bg-[var(--fc-section-hover,#1F1F1F)] rounded transition-colors"
                          title={t('chatbots.history.rename')}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={(e) => handleStartDelete(session.id, e)}
                          className="p-1.5 text-[var(--fc-section-muted,#666666)] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded transition-colors"
                          title={t('chatbots.history.delete')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ChatHistorySidebar;
