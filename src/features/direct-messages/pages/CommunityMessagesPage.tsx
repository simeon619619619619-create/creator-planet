import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Search, Send, Users, Mail } from 'lucide-react';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useCommunity } from '../../../core/contexts/CommunityContext';
import { Avatar } from '../../../shared/Avatar';
import { supabase } from '../../../core/supabase/client';
import {
  getOrCreateCreatorConversation,
  getMessages,
  sendMessage,
  markConversationAsRead,
} from '../dmService';
import type { MessageWithSender } from '../dmTypes';

interface CommunityMember {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  email: string;
}

const CommunityMessagesPage: React.FC = () => {
  const { t } = useTranslation();
  const { profile, role } = useAuth();
  const { selectedCommunity } = useCommunity();

  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<CommunityMember | null>(null);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Load community members
  useEffect(() => {
    if (!selectedCommunity?.id) return;

    const loadMembers = async () => {
      setIsLoading(true);
      try {
        const { data } = await supabase
          .from('memberships')
          .select('user_id, profiles!memberships_user_id_fkey(id, full_name, avatar_url, role, email)')
          .eq('community_id', selectedCommunity.id);

        const membersList: CommunityMember[] = [];
        data?.forEach((m: any) => {
          const p = m.profiles;
          if (p && p.id !== profile?.id) {
            membersList.push({
              id: p.id,
              full_name: p.full_name,
              avatar_url: p.avatar_url,
              role: p.role,
              email: p.email,
            });
          }
        });

        // Also add the community creator if not already in list
        if (selectedCommunity.creator_id && selectedCommunity.creator_id !== profile?.id) {
          const { data: creator } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, role, email')
            .eq('id', selectedCommunity.creator_id)
            .single();
          if (creator && !membersList.find(m => m.id === creator.id)) {
            membersList.unshift(creator);
          }
        }

        setMembers(membersList);
      } catch (err) {
        console.error('Error loading members:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadMembers();
  }, [selectedCommunity?.id, profile?.id]);

  // Load/create conversation when selecting a member
  const handleSelectMember = useCallback(async (member: CommunityMember) => {
    if (!profile?.id || !selectedCommunity?.id) return;

    setSelectedMember(member);
    setIsLoadingMessages(true);
    setMessages([]);

    try {
      // Determine creator and student for conversation
      const isCurrentUserCreator = role === 'creator' || role === 'superadmin';
      const creatorId = isCurrentUserCreator ? profile.id : selectedCommunity.creator_id;
      const studentId = isCurrentUserCreator ? member.id : profile.id;

      const conv = await getOrCreateCreatorConversation(
        selectedCommunity.id,
        creatorId,
        studentId
      );

      if (conv) {
        setConversationId(conv.id);
        const msgs = await getMessages(conv.id, 100, 0);
        setMessages(msgs);
        await markConversationAsRead(conv.id, profile.id);
      }
    } catch (err) {
      console.error('Error loading conversation:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [profile?.id, selectedCommunity?.id, role]);

  // Send message
  const handleSend = async () => {
    if (!conversationId || !newMessage.trim() || !profile?.id) return;

    setIsSending(true);
    try {
      const msg = await sendMessage(conversationId, profile.id, newMessage.trim());
      if (msg) {
        setMessages(prev => [...prev, msg]);
        setNewMessage('');
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const filteredMembers = members.filter(m =>
    !searchQuery || (m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
    m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const roleBadge = (r: string) => {
    const colors: Record<string, string> = {
      superadmin: 'text-purple-400',
      creator: 'text-blue-400',
      student: 'text-green-400',
      member: 'text-gray-400',
    };
    return <span className={`text-xs ${colors[r] || colors.member}`}>{r}</span>;
  };

  if (!selectedCommunity) {
    return (
      <div className="flex items-center justify-center h-full text-[#666666]">
        <p>Изберете общност</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Members List */}
      <div className="w-80 border-r border-[#1F1F1F] flex flex-col">
        <div className="p-4 border-b border-[#1F1F1F]">
          <div className="flex items-center gap-2 mb-3">
            <Users size={20} className="text-[#A0A0A0]" />
            <h2 className="font-semibold text-[#FAFAFA]">Членове</h2>
            <span className="text-xs text-[#666666]">({members.length})</span>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]" />
            <input
              type="text"
              placeholder="Търси..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#151515] border border-[#1F1F1F] rounded-lg text-sm text-[#FAFAFA] placeholder:text-[#666666] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#FAFAFA] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-[#666666]">
              <Mail size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Няма членове</p>
            </div>
          ) : (
            filteredMembers.map((member) => (
              <button
                key={member.id}
                onClick={() => handleSelectMember(member)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#151515] transition-colors text-left ${
                  selectedMember?.id === member.id ? 'bg-[#151515] border-l-2 border-white' : ''
                }`}
              >
                <Avatar
                  src={member.avatar_url}
                  name={member.full_name || member.email}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#FAFAFA] text-sm truncate">
                    {member.full_name || member.email}
                  </p>
                  {roleBadge(member.role)}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {!selectedMember ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-[#666666]">
              <MessageSquare size={48} className="mx-auto mb-3 opacity-50" />
              <p className="font-medium">Изберете член</p>
              <p className="text-sm mt-1">Изберете човек отляво за да чатите</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-[#1F1F1F] flex items-center gap-3">
              <Avatar
                src={selectedMember.avatar_url}
                name={selectedMember.full_name || selectedMember.email}
                size="sm"
              />
              <div>
                <p className="font-medium text-[#FAFAFA]">{selectedMember.full_name}</p>
                {roleBadge(selectedMember.role)}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoadingMessages ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-[#FAFAFA] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8 text-[#666666]">
                  <p className="text-sm">Няма съобщения. Напишете първото!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_profile_id === profile?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${
                        isMine
                          ? 'bg-white text-black rounded-br-md'
                          : 'bg-[#1F1F1F] text-[#FAFAFA] rounded-bl-md'
                      }`}>
                        <p>{msg.content}</p>
                        <p className={`text-xs mt-1 ${isMine ? 'text-gray-500' : 'text-[#666666]'}`}>
                          {new Date(msg.created_at).toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-[#1F1F1F]">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Напишете съобщение..."
                  className="flex-1 px-4 py-2 bg-[#151515] border border-[#1F1F1F] rounded-full text-[#FAFAFA] placeholder:text-[#666666] focus:outline-none focus:border-[#555555]"
                  disabled={isSending}
                />
                <button
                  onClick={handleSend}
                  disabled={isSending || !newMessage.trim()}
                  className="p-2 bg-white text-black rounded-full hover:bg-[#E0E0E0] disabled:opacity-50 transition-colors"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CommunityMessagesPage;
