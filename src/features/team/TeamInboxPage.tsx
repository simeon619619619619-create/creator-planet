import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Search, ChevronLeft, Send, Mail } from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import { Avatar } from '../../shared/Avatar';
import {
  getTeamMemberConversations,
  getMessages,
  sendMessage,
  markConversationAsRead,
} from '../direct-messages/dmService';
import { ConversationWithDetails, MessageWithSender } from '../direct-messages/dmTypes';
import { supabase } from '../../core/supabase/client';

const TeamInboxPage: React.FC = () => {
  const { t } = useTranslation();
  const { profile, teamMemberships } = useAuth();

  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithDetails | null>(null);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const teamMembership = teamMemberships?.[0];

  // Load inbox
  const loadInbox = useCallback(async () => {
    if (!teamMembership?.teamMemberId) return;

    setIsLoading(true);
    try {
      const result = await getTeamMemberConversations(teamMembership.teamMemberId);
      setConversations(result);
    } catch (error) {
      console.error('Error loading inbox:', error);
    } finally {
      setIsLoading(false);
    }
  }, [teamMembership?.teamMemberId]);

  // Load messages for selected conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    setIsLoadingMessages(true);
    try {
      const msgs = await getMessages(conversationId, 100, 0);
      setMessages(msgs);

      // Mark as read in background (don't block UI)
      if (profile?.id) {
        markConversationAsRead(conversationId, profile.id)
          .then(() => {
            // Update local state to clear unread indicator
            setConversations(prev => prev.map(c =>
              c.id === conversationId ? { ...c, unread_count_team: 0 } : c
            ));
          })
          .catch(err => console.error('Failed to mark as read:', err));
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  // Load messages when conversation selected
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation, loadMessages]);

  // Subscribe to new messages
  useEffect(() => {
    if (!selectedConversation) return;

    const channel = supabase
      .channel(`conversation:${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        () => {
          // Reload messages when new one arrives
          loadMessages(selectedConversation.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, loadMessages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !profile?.id || isSending) return;

    setIsSending(true);
    try {
      const result = await sendMessage(
        selectedConversation.id,
        profile.id,
        newMessage.trim()
      );

      if (result) {
        setNewMessage('');
        loadMessages(selectedConversation.id);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isYesterday) {
      return t('common.yesterday');
    }

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const filteredConversations = conversations.filter((conv) => {
    const studentName = conv.student?.full_name || '';
    return studentName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#333333] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-[#0A0A0A]">
      {/* Inbox List */}
      <div
        className={`
          w-full md:w-80 lg:w-96 border-r border-[#1F1F1F] flex flex-col
          ${selectedConversation ? 'hidden md:flex' : 'flex'}
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#1F1F1F]">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-[#FAFAFA]" />
            <h1 className="text-lg font-semibold text-[#FAFAFA]">{t('teamInbox.title')}</h1>
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666666]" />
            <input
              type="text"
              placeholder={t('teamInbox.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-[#1F1F1F] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <Mail className="w-12 h-12 text-[#A0A0A0] mx-auto mb-3" />
              <p className="text-[#666666]">{t('teamInbox.noConversations')}</p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const hasUnread = (conv.unread_count_team || 0) > 0;
              const studentName = conv.student?.full_name || 'Student';
              const studentAvatar = conv.student?.avatar_url || null;
              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`
                    p-4 border-b border-[#1F1F1F] cursor-pointer transition-colors
                    ${selectedConversation?.id === conv.id ? 'bg-[#151515]' : 'hover:bg-[#0A0A0A]'}
                  `}
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      src={studentAvatar}
                      name={studentName}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className={`text-sm font-medium truncate ${hasUnread ? 'text-[#FAFAFA]' : 'text-[#A0A0A0]'}`}>
                          {studentName}
                        </p>
                        <span className="text-xs text-[#666666] shrink-0 ml-2">
                          {formatTime(conv.last_message_at)}
                        </span>
                      </div>
                      <p className={`text-sm truncate ${hasUnread ? 'text-[#A0A0A0] font-medium' : 'text-[#666666]'}`}>
                        {conv.last_message?.content || t('teamInbox.startConversation')}
                      </p>
                    </div>
                    {hasUnread && (
                      <div className="w-2.5 h-2.5 bg-white rounded-full shrink-0 mt-1.5"></div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Conversation View */}
      <div
        className={`
          flex-1 flex flex-col
          ${selectedConversation ? 'flex' : 'hidden md:flex'}
        `}
      >
        {selectedConversation ? (
          <>
            {/* Conversation Header */}
            <div className="p-4 border-b border-[#1F1F1F] flex items-center gap-3">
              <button
                onClick={() => setSelectedConversation(null)}
                className="md:hidden p-1 hover:bg-[#1F1F1F] rounded"
              >
                <ChevronLeft className="w-5 h-5 text-[#A0A0A0]" />
              </button>
              <Avatar
                src={selectedConversation.student?.avatar_url}
                name={selectedConversation.student?.full_name || 'Student'}
                size="md"
              />
              <div>
                <p className="font-medium text-[#FAFAFA]">{selectedConversation.student?.full_name || 'Student'}</p>
                <p className="text-xs text-[#666666]">{t('teamInbox.student')}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin w-6 h-6 border-2 border-[#333333] border-t-transparent rounded-full"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageSquare className="w-12 h-12 text-[#A0A0A0] mx-auto mb-3" />
                    <p className="text-[#666666]">{t('teamInbox.noMessages')}</p>
                    <p className="text-sm text-[#666666]">{t('teamInbox.startConversationHint')}</p>
                  </div>
                </div>
              ) : (
                messages.map((message) => {
                  const isOwnMessage = message.sender_profile_id === profile?.id;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`
                          max-w-[70%] rounded-2xl px-4 py-2
                          ${isOwnMessage
                            ? 'bg-[#FAFAFA] text-black rounded-br-md'
                            : 'bg-[#151515] text-[#A0A0A0] rounded-bl-md'}
                        `}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        <p className={`text-xs mt-1 ${isOwnMessage ? 'text-[#A0A0A0]' : 'text-[#666666]'}`}>
                          {formatTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-[#1F1F1F]">
              <div className="flex items-end gap-2">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={t('teamInbox.typeMessage')}
                  rows={1}
                  className="flex-1 px-4 py-2 border border-[#1F1F1F] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-white/10 focus:border-[#555555] resize-none max-h-32"
                  style={{ minHeight: '40px' }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || isSending}
                  className={`
                    p-2 rounded-lg transition-colors
                    ${newMessage.trim() && !isSending
                      ? 'bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] hover:bg-[#E0E0E0]'
                      : 'bg-[#1F1F1F] text-[#666666] cursor-not-allowed'}
                  `}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-[#A0A0A0] mx-auto mb-4" />
              <h3 className="text-lg font-medium text-[#A0A0A0] mb-1">{t('teamInbox.selectConversation')}</h3>
              <p className="text-sm text-[#666666]">{t('teamInbox.selectConversationHint')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamInboxPage;
