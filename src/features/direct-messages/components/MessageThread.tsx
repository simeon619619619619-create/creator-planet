// ============================================================================
// MESSAGE THREAD COMPONENT
// Scrollable message history with proper alignment
// ============================================================================

import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import type { MessageWithSender } from '../dmTypes';

interface MessageThreadProps {
  messages: MessageWithSender[];
  currentUserProfileId: string;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

const MessageThread: React.FC<MessageThreadProps> = ({
  messages,
  currentUserProfileId,
  isLoading = false,
  hasMore = false,
  onLoadMore,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length]);

  // Initial scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, []);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return t('directMessages.thread.today');
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return t('directMessages.thread.yesterday');
    }
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: MessageWithSender[] }[] = [];
  let currentDate = '';

  messages.forEach((msg) => {
    const msgDate = new Date(msg.created_at).toDateString();
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groupedMessages.push({ date: msg.created_at, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  });

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-3 space-y-4"
    >
      {/* Load More Button */}
      {hasMore && (
        <div className="text-center">
          <button
            onClick={onLoadMore}
            disabled={isLoading}
            className="text-sm text-[var(--fc-section-text,#FAFAFA)] hover:text-[var(--fc-section-muted,#A0A0A0)] disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center gap-2 justify-center">
                <Loader2 size={14} className="animate-spin" />
                {t('directMessages.thread.loading')}
              </span>
            ) : (
              t('directMessages.thread.loadMore')
            )}
          </button>
        </div>
      )}

      {/* Loading Spinner (initial load) */}
      {isLoading && messages.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--fc-section-text,#FAFAFA)]" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && messages.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-[var(--fc-section-hover,#1F1F1F)] rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-[var(--fc-section-muted,#666666)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <p className="text-[var(--fc-section-muted,#666666)] font-medium">
            {t('directMessages.thread.noMessages')}
          </p>
          <p className="text-[var(--fc-section-muted,#666666)] text-sm mt-1">
            {t('directMessages.thread.startConversation')}
          </p>
        </div>
      )}

      {/* Messages grouped by date */}
      {groupedMessages.map((group) => (
        <div key={group.date}>
          {/* Date Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-[var(--fc-section-hover,#1F1F1F)]" />
            <span className="text-xs text-[var(--fc-section-muted,#666666)] font-medium">
              {formatDate(group.date)}
            </span>
            <div className="flex-1 h-px bg-[var(--fc-section-hover,#1F1F1F)]" />
          </div>

          {/* Messages */}
          <div className="space-y-3">
            {group.messages.map((msg) => {
              const isSelf = msg.sender_profile_id === currentUserProfileId;
              const senderName = msg.sender?.full_name || t('directMessages.thread.unknownSender');
              const avatarUrl = msg.sender?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=6366f1&color=fff`;

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${isSelf ? 'flex-row-reverse' : ''}`}
                >
                  {/* Avatar (only show for others) */}
                  {!isSelf && (
                    <img
                      src={avatarUrl}
                      alt={senderName}
                      className="w-8 h-8 rounded-full object-cover shrink-0 mt-1"
                    />
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                      isSelf
                        ? 'bg-[#FAFAFA] text-black rounded-br-md'
                        : 'bg-[var(--fc-section-hover,#151515)] text-[var(--fc-section-muted,#A0A0A0)] rounded-bl-md'
                    }`}
                  >
                    {!isSelf && (
                      <p className="text-xs font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                        {senderName}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                    <p
                      className={`text-[10px] mt-1 ${
                        isSelf ? 'text-[var(--fc-section-muted,#A0A0A0)]' : 'text-[var(--fc-section-muted,#666666)]'
                      }`}
                    >
                      {formatTime(msg.created_at)}
                      {msg.read_at && isSelf && (
                        <span className="ml-1">{t('directMessages.thread.read')}</span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageThread;
