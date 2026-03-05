// ============================================================================
// CHAT PANEL COMPONENT
// Full chat interface that replaces posts area when messaging
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, Eye } from 'lucide-react';
import type {
  TeamMemberWithProfile,
  ConversationWithDetails,
  MessageWithSender,
  ChatViewMode,
} from '../dmTypes';
import { getBadgeType } from '../dmTypes';
import {
  getOrCreateConversation,
  getOrCreateCreatorConversation,
  getMessages,
  sendMessage,
  markConversationAsRead,
  markCreatorConversationAsRead,
  getTeamMemberConversations,
  getCommunityConversations,
} from '../dmService';
import { supabase } from '../../../core/supabase/client';
import MessageThread from './MessageThread';
import MessageInput from './MessageInput';
import ConversationList from './ConversationList';

interface ChatPanelProps {
  communityId: string;
  currentUserProfileId: string;
  selectedTeamMember: TeamMemberWithProfile | null;
  creatorChatTargetId?: string | null; // Profile ID for creator-student DM
  viewMode: ChatViewMode;
  isCreator: boolean;
  isCurrentUserTeamMember: boolean;
  currentUserTeamMemberId?: string | null;
  onClose: () => void;
}

// Profile info for creator-student chat header
interface CreatorChatPartnerInfo {
  full_name: string;
  avatar_url: string | null;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  communityId,
  currentUserProfileId,
  selectedTeamMember,
  creatorChatTargetId,
  viewMode,
  isCreator,
  isCurrentUserTeamMember,
  currentUserTeamMemberId,
  onClose,
}) => {
  const { t } = useTranslation();

  // State
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithDetails | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [creatorChatPartner, setCreatorChatPartner] = useState<CreatorChatPartnerInfo | null>(null);

  // Determine the actual view mode based on user role
  const getEffectiveViewMode = useCallback((): 'chat' | 'inbox' | 'conversation_view' => {
    // Creator-student direct chat mode
    if (creatorChatTargetId) {
      return 'chat';
    }

    if (!selectedTeamMember) return 'chat';

    // Creator viewing a team member -> show that team member's inbox (oversight)
    if (isCreator && selectedTeamMember.profile_id !== currentUserProfileId) {
      return 'inbox';
    }

    // Team member viewing their own entry -> show their inbox
    if (isCurrentUserTeamMember && selectedTeamMember.profile_id === currentUserProfileId) {
      return 'inbox';
    }

    // Student viewing team member -> direct chat
    return 'chat';
  }, [selectedTeamMember, creatorChatTargetId, isCreator, isCurrentUserTeamMember, currentUserProfileId]);

  const effectiveViewMode = getEffectiveViewMode();

  // Load conversations for inbox view
  useEffect(() => {
    if (effectiveViewMode === 'inbox' && selectedTeamMember) {
      loadConversations();
    }
  }, [effectiveViewMode, selectedTeamMember]);

  // Load or create conversation for chat view (team member)
  useEffect(() => {
    if (effectiveViewMode === 'chat' && selectedTeamMember) {
      initializeChat();
    }
  }, [effectiveViewMode, selectedTeamMember]);

  // Load or create conversation for creator-student chat
  useEffect(() => {
    if (effectiveViewMode === 'chat' && creatorChatTargetId) {
      initializeCreatorChat();
    }
  }, [effectiveViewMode, creatorChatTargetId]);

  // Load messages when conversation changes
  useEffect(() => {
    if (currentConversationId) {
      loadMessages(currentConversationId);
    }
  }, [currentConversationId]);

  const loadConversations = async () => {
    if (!selectedTeamMember) return;

    setIsLoadingConversations(true);
    try {
      let convs: ConversationWithDetails[];

      if (isCreator) {
        // Creator oversight: get conversations for the selected team member
        convs = await getCommunityConversations(communityId, selectedTeamMember.id);
      } else if (isCurrentUserTeamMember && currentUserTeamMemberId) {
        // Team member viewing their own inbox
        convs = await getTeamMemberConversations(currentUserTeamMemberId);
      } else {
        convs = [];
      }

      setConversations(convs);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const initializeChat = async () => {
    if (!selectedTeamMember) return;

    setIsLoadingMessages(true);
    try {
      const conv = await getOrCreateConversation(
        communityId,
        currentUserProfileId,
        selectedTeamMember.id
      );

      if (conv) {
        setCurrentConversationId(conv.id);
        // Mark as read in background (don't block UI)
        markConversationAsRead(conv.id, currentUserProfileId).catch(err => {
          console.error('Failed to mark conversation as read:', err);
        });
      }
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const initializeCreatorChat = async () => {
    if (!creatorChatTargetId) return;

    setIsLoadingMessages(true);
    try {
      // Determine who is creator and who is student
      // If current user is creator, target is student
      // If current user is student, target is creator
      const creatorId = isCreator ? currentUserProfileId : creatorChatTargetId;
      const studentId = isCreator ? creatorChatTargetId : currentUserProfileId;

      // Load the chat partner's profile info for header
      const { data: partnerProfile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', creatorChatTargetId)
        .single();

      if (partnerProfile) {
        setCreatorChatPartner(partnerProfile);
      }

      const conv = await getOrCreateCreatorConversation(
        communityId,
        creatorId,
        studentId
      );

      if (conv) {
        setCurrentConversationId(conv.id);
        // Mark as read in background
        markCreatorConversationAsRead(conv.id, currentUserProfileId).catch(err => {
          console.error('Failed to mark creator conversation as read:', err);
        });
      }
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const loadMessages = async (conversationId: string, append: boolean = false) => {
    if (!append) {
      setIsLoadingMessages(true);
    }

    try {
      const offset = append ? messages.length : 0;
      const newMessages = await getMessages(conversationId, 50, offset);

      if (append) {
        setMessages(prev => [...newMessages, ...prev]);
      } else {
        setMessages(newMessages);
      }

      setHasMore(newMessages.length === 50);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!currentConversationId) return;

    const newMessage = await sendMessage(
      currentConversationId,
      currentUserProfileId,
      content
    );

    if (newMessage) {
      setMessages(prev => [...prev, newMessage]);
    }
  };

  const handleSelectConversation = async (conv: ConversationWithDetails) => {
    setSelectedConversation(conv);
    setCurrentConversationId(conv.id);

    // Mark as read if not creator (creator is oversight only)
    if (!isCreator) {
      await markConversationAsRead(conv.id, currentUserProfileId);
    }
  };

  const handleBackFromConversation = () => {
    setSelectedConversation(null);
    setCurrentConversationId(null);
    setMessages([]);
  };

  const handleLoadMore = () => {
    if (currentConversationId && !isLoadingMessages) {
      loadMessages(currentConversationId, true);
    }
  };

  // Render inbox view
  if (effectiveViewMode === 'inbox' && !selectedConversation) {
    return (
      <div className="h-full flex flex-col bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] overflow-hidden">
        <ConversationList
          conversations={conversations}
          isLoading={isLoadingConversations}
          onSelectConversation={handleSelectConversation}
          onBack={onClose}
          teamMember={selectedTeamMember}
          isCreatorView={isCreator}
        />
      </div>
    );
  }

  // Get display info for the header
  const getHeaderInfo = () => {
    if (selectedConversation) {
      // Viewing a conversation from inbox
      const student = selectedConversation.student;
      return {
        name: student?.full_name || t('directMessages.chatPanel.unknownStudent'),
        avatarUrl: student?.avatar_url || `https://ui-avatars.com/api/?name=Student&background=6366f1&color=fff`,
        title: null,
        badgeType: null as 'team' | 'guest' | null,
        isOversightView: isCreator,
      };
    } else if (creatorChatTargetId && creatorChatPartner) {
      // Creator-student direct chat
      return {
        name: creatorChatPartner.full_name || t('directMessages.chatPanel.unknownMember'),
        avatarUrl: creatorChatPartner.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(creatorChatPartner.full_name || 'User')}&background=6366f1&color=fff`,
        title: isCreator ? t('communityHub.userProfile.role.student') : t('communityHub.userProfile.role.creator'),
        badgeType: null as 'team' | 'guest' | null,
        isOversightView: false,
      };
    } else if (selectedTeamMember) {
      // Direct chat with team member
      const profile = selectedTeamMember.profile;
      return {
        name: profile?.full_name || t('directMessages.chatPanel.unknownMember'),
        avatarUrl: profile?.avatar_url || `https://ui-avatars.com/api/?name=Team&background=6366f1&color=fff`,
        title: selectedTeamMember.title,
        badgeType: getBadgeType(selectedTeamMember.role),
        isOversightView: false,
      };
    }
    return null;
  };

  const headerInfo = getHeaderInfo();

  // Creator viewing another team member's inbox = oversight mode (view only)
  // They can only send if viewing their OWN inbox or if they're not a creator
  const isOversightView = isCreator && selectedTeamMember && selectedTeamMember.profile_id !== currentUserProfileId;
  const canSendMessages = !isOversightView;

  // In oversight mode, show messages from the team member's perspective
  // (team member's messages on right, student's on left)
  const messageThreadPerspectiveId = isOversightView && selectedTeamMember?.profile_id
    ? selectedTeamMember.profile_id
    : currentUserProfileId;

  return (
    <div className="h-full flex flex-col bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[#1F1F1F] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {selectedConversation && (
              <button
                onClick={handleBackFromConversation}
                className="p-1.5 hover:bg-[#1F1F1F] rounded-lg transition-colors shrink-0"
                title={t('directMessages.chatPanel.backToInbox')}
              >
                <svg className="w-5 h-5 text-[#A0A0A0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            {headerInfo && (
              <>
                <img
                  src={headerInfo.avatarUrl}
                  alt={headerInfo.name}
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-[#FAFAFA] truncate">
                      {headerInfo.name}
                    </h2>
                    {headerInfo.badgeType && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0
                          ${headerInfo.badgeType === 'team'
                            ? 'bg-[#1F1F1F] text-[#A0A0A0]'
                            : 'bg-[#EAB308]/10 text-[#EAB308]'
                          }
                        `}
                      >
                        {headerInfo.badgeType === 'team'
                          ? t('directMessages.teamSection.badgeTeam')
                          : t('directMessages.teamSection.badgeGuest')
                        }
                      </span>
                    )}
                    {headerInfo.isOversightView && (
                      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-[#1F1F1F] text-[#A0A0A0] shrink-0">
                        <Eye size={10} />
                        {t('directMessages.chatPanel.oversightMode')}
                      </span>
                    )}
                  </div>
                  {headerInfo.title && (
                    <p className="text-sm text-[#666666] truncate">{headerInfo.title}</p>
                  )}
                </div>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#1F1F1F] rounded-lg transition-colors shrink-0"
            title={t('directMessages.chatPanel.close')}
          >
            <X size={20} className="text-[#A0A0A0]" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <MessageThread
        messages={messages}
        currentUserProfileId={messageThreadPerspectiveId}
        isLoading={isLoadingMessages}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
      />

      {/* Input (only if can send) */}
      {canSendMessages ? (
        <MessageInput
          onSend={handleSendMessage}
          disabled={!currentConversationId || isLoadingMessages}
        />
      ) : (
        <div className="border-t border-[#1F1F1F] bg-[#0A0A0A] px-4 py-3">
          <p className="text-sm text-[#666666] text-center">
            {t('directMessages.chatPanel.oversightOnlyHint')}
          </p>
        </div>
      )}
    </div>
  );
};

export default ChatPanel;
