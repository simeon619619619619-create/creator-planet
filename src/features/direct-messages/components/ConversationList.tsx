// ============================================================================
// CONVERSATION LIST COMPONENT
// Inbox view for lecturers/creators showing all conversations
// ============================================================================

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, MessageCircle, Loader2 } from 'lucide-react';
import type { ConversationWithDetails, TeamMemberWithProfile } from '../dmTypes';
import { getBadgeType } from '../dmTypes';

interface ConversationListProps {
  conversations: ConversationWithDetails[];
  isLoading?: boolean;
  onSelectConversation: (conversation: ConversationWithDetails) => void;
  onBack: () => void;
  teamMember?: TeamMemberWithProfile | null;
  isCreatorView?: boolean;
  selectedConversationId?: string | null;
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  isLoading = false,
  onSelectConversation,
  onBack,
  teamMember,
  isCreatorView = false,
  selectedConversationId,
}) => {
  const { t } = useTranslation();

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return t('directMessages.conversationList.justNow');
    if (diffMins < 60) return t('directMessages.conversationList.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('directMessages.conversationList.hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('directMessages.conversationList.daysAgo', { count: diffDays });
    return date.toLocaleDateString();
  };

  const truncateMessage = (content: string, maxLength: number = 50) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength).trim() + '...';
  };

  // Header info
  const headerName = teamMember?.profile?.full_name || t('directMessages.conversationList.inbox');
  const chatCount = conversations.length;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            title={t('directMessages.conversationList.back')}
          >
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-slate-900 truncate">
                {isCreatorView && teamMember
                  ? t('directMessages.conversationList.inboxOf', { name: headerName })
                  : t('directMessages.conversationList.myInbox')
                }
              </h2>
              {teamMember && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0
                    ${getBadgeType(teamMember.role) === 'team'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-amber-100 text-amber-700'
                    }
                  `}
                >
                  {getBadgeType(teamMember.role) === 'team'
                    ? t('directMessages.teamSection.badgeTeam')
                    : t('directMessages.teamSection.badgeGuest')
                  }
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">
              {t('directMessages.conversationList.chatCount', { count: chatCount })}
            </p>
          </div>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        )}

        {!isLoading && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 font-medium">
              {t('directMessages.conversationList.noConversations')}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {t('directMessages.conversationList.noConversationsHint')}
            </p>
          </div>
        )}

        {!isLoading && conversations.length > 0 && (
          <div className="divide-y divide-slate-100">
            {conversations.map((conv) => {
              const student = conv.student;
              const studentName = student?.full_name || t('directMessages.conversationList.unknownStudent');
              const avatarUrl = student?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(studentName)}&background=6366f1&color=fff`;
              const hasUnread = isCreatorView
                ? false // Creator can't have unread (oversight only)
                : conv.unread_count_team > 0;
              const lastMessage = conv.last_message?.content;
              const isSelected = selectedConversationId === conv.id;

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelectConversation(conv)}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left
                    ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'}
                  `}
                >
                  {/* Avatar with unread dot */}
                  <div className="relative shrink-0">
                    <img
                      src={avatarUrl}
                      alt={studentName}
                      className="w-11 h-11 rounded-full object-cover"
                    />
                    {hasUnread && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-medium truncate ${hasUnread ? 'text-slate-900' : 'text-slate-700'}`}>
                        {studentName}
                      </span>
                      <span className="text-xs text-slate-400 shrink-0">
                        {formatTimestamp(conv.last_message_at)}
                      </span>
                    </div>
                    {lastMessage && (
                      <p className={`text-sm truncate mt-0.5 ${hasUnread ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                        {truncateMessage(lastMessage)}
                      </p>
                    )}
                    {!lastMessage && (
                      <p className="text-sm text-slate-400 italic mt-0.5">
                        {t('directMessages.conversationList.noMessagesYet')}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationList;
