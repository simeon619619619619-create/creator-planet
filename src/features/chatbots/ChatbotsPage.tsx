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

  // Chat history sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState(0); // Force re-render on new chat

  // Load active chatbots on mount
  useEffect(() => {
    const loadChatbots = async () => {
      setIsLoading(true);
      try {
        const activeChatbots = await getActiveChatbots(communityId);
        setChatbots(activeChatbots);
        // Auto-select first chatbot if available
        if (activeChatbots.length > 0) {
          setSelectedChatbot(activeChatbots[0]);
        }
      } catch (error) {
        console.error('Error loading chatbots:', error);
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
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      </div>
    );
  }

  // Empty state - no active chatbots
  if (chatbots.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-5xl mx-auto px-6 py-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-100 rounded-xl">
                <Bot className="w-7 h-7 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{t('chatbots.page.title')}</h1>
                <p className="text-slate-600">{t('chatbots.page.subtitle')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Empty State */}
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <MessageCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              {t('chatbots.page.emptyState.title')}
            </h2>
            <p className="text-slate-600 max-w-md mx-auto">
              {t('chatbots.page.emptyState.description')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-3 bg-indigo-100 rounded-xl">
                <Bot className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{t('chatbots.page.title')}</h1>
                <p className="hidden sm:block text-slate-600">{t('chatbots.page.subtitle')}</p>
              </div>
            </div>
            {/* Manage Chatbots button for creators */}
            {isCreator && onManageChatbots && (
              <button
                onClick={onManageChatbots}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg transition-colors"
              >
                <Settings size={18} />
                {t('chatbots.page.manageBots')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto">
            {chatbots.map((chatbot) => (
              <button
                key={chatbot.id}
                onClick={() => handleSelectChatbot(chatbot)}
                className={`px-3 sm:px-4 py-2 sm:py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                  selectedChatbot?.id === chatbot.id
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
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
        <div className="h-[calc(100dvh-180px)] sm:h-[calc(100dvh-270px)] bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden flex relative">
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
