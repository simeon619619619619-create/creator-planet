import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, MessageCircle, Loader2, Settings } from 'lucide-react';
import { DbCommunityChatbot } from '../../core/supabase/database.types';
import { getActiveChatbots, createSession } from './chatbotService';
import ChatbotConversation from './ChatbotConversation';
import ChatHistorySidebar from './ChatHistorySidebar';
import { useAuth } from '../../core/contexts/AuthContext';

interface ChatbotsPageProps {
  communityId: string;
  onManageChatbots?: () => void; // Navigate to Settings → Chatbots
}

// Role emoji mapping
const ROLE_EMOJIS: Record<string, string> = {
  qa: '🤖',
  motivation: '💪',
  support: '🛠️',
};

const ChatbotsPage: React.FC<ChatbotsPageProps> = ({ communityId, onManageChatbots }) => {
  const { t } = useTranslation();
  const { profile, role } = useAuth();
  const isCreator = role === 'creator' || role === 'superadmin';
  const [chatbots, setChatbots] = useState<DbCommunityChatbot[]>([]);
  const [selectedChatbot, setSelectedChatbot] = useState<DbCommunityChatbot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Chat history sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState(0); // Force re-render on new chat

  // Load active chatbots on mount
  useEffect(() => {
    const loadChatbots = async () => {
      setIsLoading(true);
      setLoadError(false);
      try {
        const activeChatbots = await getActiveChatbots(communityId);
        setChatbots(activeChatbots);
        // Auto-select first chatbot if available
        if (activeChatbots.length > 0) {
          setSelectedChatbot(activeChatbots[0]);
        }
      } catch (error) {
        console.error('Error loading chatbots:', error);
        setLoadError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadChatbots();
  }, [communityId]);

  // Reset session when switching chatbots
  const handleSelectChatbot = useCallback((chatbot: DbCommunityChatbot) => {
    setSelectedChatbot(chatbot);
    setSelectedSessionId(null); // Start fresh for new chatbot
    setSessionKey((k) => k + 1);
  }, []);

  // Handle new chat button
  const handleNewChat = useCallback(async () => {
    if (!selectedChatbot || !profile?.id) return;

    // Create a new session
    const newSession = await createSession(selectedChatbot.id, profile.id);
    if (newSession) {
      setSelectedSessionId(newSession.id);
      setSessionKey((k) => k + 1);
    }
  }, [selectedChatbot, profile?.id]);

  // Handle session selection from sidebar
  const handleSelectSession = useCallback((sessionId: string | null) => {
    setSelectedSessionId(sessionId);
    setSessionKey((k) => k + 1);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-[#FAFAFA] animate-spin" />
      </div>
    );
  }

  // Error state - failed to load chatbots
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-[#A0A0A0]">{t('chatbots.errorLoading', 'Failed to load chatbots. Please try again.')}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-[#1F1F1F] text-[#FAFAFA] rounded-lg hover:bg-[#333333] transition-colors"
        >
          {t('common.retry', 'Retry')}
        </button>
      </div>
    );
  }

  // Empty state - no active chatbots
  if (chatbots.length === 0) {
    return (
      <div className="min-h-screen bg-[#0A0A0A]">
        {/* Header */}
        <div className="bg-[#0A0A0A] border-b border-[#1F1F1F]">
          <div className="max-w-5xl mx-auto px-6 py-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#1F1F1F] rounded-xl">
                <Bot className="w-7 h-7 text-[#FAFAFA]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#FAFAFA]">{t('chatbots.page.title')}</h1>
                <p className="text-[#A0A0A0]">{t('chatbots.page.subtitle')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Empty State */}
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] p-12 text-center">
            <MessageCircle className="w-16 h-16 text-[#666666] mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-[#FAFAFA] mb-2">
              {t('chatbots.page.emptyState.title')}
            </h2>
            <p className="text-[#A0A0A0] max-w-md mx-auto">
              {t('chatbots.page.emptyState.description')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
      {/* Header */}
      <div className="bg-[#0A0A0A] border-b border-[#1F1F1F]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-3 bg-[#1F1F1F] rounded-xl">
                <Bot className="w-6 h-6 sm:w-7 sm:h-7 text-[#FAFAFA]" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#FAFAFA]">{t('chatbots.page.title')}</h1>
                <p className="hidden sm:block text-[#A0A0A0]">{t('chatbots.page.subtitle')}</p>
              </div>
            </div>
            {/* Manage Chatbots button for creators */}
            {isCreator && onManageChatbots && (
              <button
                onClick={onManageChatbots}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#A0A0A0] hover:text-[#FAFAFA] bg-[#0A0A0A] hover:bg-[#1F1F1F] border border-[#1F1F1F] hover:border-[#333333] rounded-lg transition-colors"
              >
                <Settings size={18} />
                {t('chatbots.page.manageBots')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-[#0A0A0A] border-b border-[#1F1F1F]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto">
            {chatbots.map((chatbot) => (
              <button
                key={chatbot.id}
                onClick={() => handleSelectChatbot(chatbot)}
                className={`px-3 sm:px-4 py-2 sm:py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                  selectedChatbot?.id === chatbot.id
                    ? 'border-white text-[#FAFAFA] bg-[#1F1F1F]/50'
                    : 'border-transparent text-[#A0A0A0] hover:text-[#FAFAFA] hover:bg-[#0A0A0A]'
                }`}
              >
                {/* Avatar - custom image, emoji, or hidden */}
                {chatbot.show_avatar !== false ? (
                  chatbot.avatar_url ? (
                    <img
                      src={chatbot.avatar_url}
                      alt={chatbot.name}
                      className="w-6 h-6 rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const span = document.createElement('span');
                        span.textContent = ROLE_EMOJIS[chatbot.role] || '🤖';
                        e.currentTarget.parentElement?.insertBefore(span, e.currentTarget);
                      }}
                    />
                  ) : (
                    <span>{ROLE_EMOJIS[chatbot.role] || '🤖'}</span>
                  )
                ) : null}
                {chatbot.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Area with Sidebar */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-5">
        <div className="h-[calc(100dvh-180px)] sm:h-[calc(100dvh-270px)] bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl overflow-hidden flex relative">
          {/* Chat History Sidebar */}
          {selectedChatbot && profile?.id && (
            <ChatHistorySidebar
              chatbotId={selectedChatbot.id}
              userId={profile.id}
              isOpen={isSidebarOpen}
              onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
              selectedSessionId={selectedSessionId}
              onSelectSession={handleSelectSession}
              onNewChat={handleNewChat}
            />
          )}

          {/* Conversation Area */}
          <div className="flex-1 min-w-0">
            {selectedChatbot && (
              <ChatbotConversation
                key={`${selectedChatbot.id}-${sessionKey}`}
                chatbot={selectedChatbot}
                sessionId={selectedSessionId}
                onSessionCreated={(newSessionId) => setSelectedSessionId(newSessionId)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatbotsPage;
