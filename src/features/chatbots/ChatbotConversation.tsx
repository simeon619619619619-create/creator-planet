import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Loader2, Bot, User } from 'lucide-react';
import { DbCommunityChatbot } from '../../core/supabase/database.types';
import { useAuth } from '../../core/contexts/AuthContext';
import {
  ChatMessage,
  getSessionMessages,
  addMessage,
  createSession,
  updateSessionTitle,
} from './chatbotService';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

interface ChatbotConversationProps {
  chatbot: DbCommunityChatbot;
  sessionId: string | null;
  onSessionCreated?: (sessionId: string) => void;
}

/**
 * Send a message to a chatbot using its custom system prompt
 */
async function sendChatbotMessage(
  message: string,
  history: { role: 'user' | 'model'; text: string }[],
  systemPrompt: string,
  userName?: string,
  errorMessages?: { apiKeyMissing: string; noResponse: string; connectionError: string }
): Promise<string> {
  if (!apiKey) {
    return errorMessages?.apiKeyMissing || 'API Key is missing. Please check your environment configuration.';
  }

  try {
    // Build messages array for the AI
    const messages = [
      ...history.map((h) => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.text,
      })),
      { role: 'user', content: message },
    ];

    // Call the Supabase Edge Function
    const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        messages: messages,
        systemInstruction: systemPrompt,
        apiKey: apiKey,
        userName: userName,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Edge Function Error:', error);
      throw new Error(error.error || 'API request failed');
    }

    const data = await response.json();
    return data.content || (errorMessages?.noResponse || "I couldn't generate a response.");
  } catch (error) {
    console.error('Chatbot Error:', error);
    return errorMessages?.connectionError || "I'm having trouble connecting right now. Please try again later.";
  }
}

const ChatbotConversation: React.FC<ChatbotConversationProps> = ({
  chatbot,
  sessionId,
  onSessionCreated,
}) => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId);
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Update currentSessionId when prop changes
  useEffect(() => {
    setCurrentSessionId(sessionId);
  }, [sessionId]);

  // Load session messages on mount or when session changes
  useEffect(() => {
    const loadSessionMessages = async () => {
      setIsLoading(true);
      setMessages([]);

      if (!profile?.id) {
        setIsLoading(false);
        return;
      }

      try {
        if (currentSessionId) {
          // Load existing session messages
          const sessionMessages = await getSessionMessages(currentSessionId);
          setMessages(sessionMessages);
          setIsFirstMessage(sessionMessages.length === 0);
        } else {
          // New chat - no messages yet, show greeting if available
          setMessages([]);
          setIsFirstMessage(true);
        }
      } catch (error) {
        console.error('Error loading session messages:', error);
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadSessionMessages();
  }, [currentSessionId, profile?.id]);

  const handleSend = async () => {
    const trimmedMessage = inputValue.trim();
    if (!trimmedMessage || isSending || !profile?.id) return;

    setInputValue('');
    setIsSending(true);

    let activeSessionId = currentSessionId;

    try {
      // Create session if this is the first message (no session yet)
      if (!activeSessionId) {
        const newSession = await createSession(chatbot.id, profile.id);
        if (!newSession) {
          throw new Error('Failed to create session');
        }
        activeSessionId = newSession.id;
        setCurrentSessionId(activeSessionId);
        onSessionCreated?.(activeSessionId);
      }

      // Add user message to database
      const userMessage = await addMessage(activeSessionId, 'user', trimmedMessage);
      if (!userMessage) {
        throw new Error('Failed to save user message');
      }

      // Update UI immediately with user message
      setMessages((prev) => [...prev, userMessage]);

      // Update session title with first user message (truncated)
      if (isFirstMessage) {
        const title = trimmedMessage.slice(0, 50);
        await updateSessionTitle(activeSessionId, title);
        setIsFirstMessage(false);
      }

      // Build history for the API
      const history = messages.map((m) => ({ role: m.role, text: m.content }));

      // Get bot response using chatbot's system prompt
      const botResponseText = await sendChatbotMessage(
        trimmedMessage,
        history,
        chatbot.system_prompt || t('chatbots.conversation.defaultSystemPrompt'),
        profile.full_name || undefined,
        {
          apiKeyMissing: t('chatbots.conversation.errors.apiKeyMissing'),
          noResponse: t('chatbots.conversation.errors.noResponse'),
          connectionError: t('chatbots.conversation.errors.connectionError'),
        }
      );

      // Add bot response to database
      const botMessage = await addMessage(activeSessionId, 'model', botResponseText);
      if (botMessage) {
        setMessages((prev) => [...prev, botMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);

      // Add error message to UI (not saved to DB)
      const errorMessage: ChatMessage = {
        id: 'error-' + Date.now(),
        session_id: activeSessionId || '',
        role: 'model',
        content: t('chatbots.conversation.errors.generic'),
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Send on Enter without Shift
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12">
        <Loader2 size={32} className="animate-spin text-indigo-600 mb-3" />
        <p className="text-slate-500">{t('chatbots.conversation.loading')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-slate-500 py-6 sm:py-8">
            {/* Empty state avatar */}
            {chatbot.show_avatar !== false && chatbot.avatar_url ? (
              <img
                src={chatbot.avatar_url}
                alt={chatbot.name}
                className="w-12 h-12 mx-auto mb-3 rounded-full object-cover"
              />
            ) : (
              <Bot size={48} className="mx-auto mb-3 text-slate-300" />
            )}
            <p>{t('chatbots.conversation.emptyState', { botName: chatbot.name })}</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex items-start gap-2 max-w-[80%] ${
                  message.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                {/* Avatar */}
                {message.role === 'user' ? (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
                    <User size={16} className="text-white" />
                  </div>
                ) : chatbot.show_avatar !== false && chatbot.avatar_url ? (
                  <img
                    src={chatbot.avatar_url}
                    alt={chatbot.name}
                    className="flex-shrink-0 w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                    <Bot size={16} className="text-slate-600" />
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`px-4 py-2 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-md'
                      : 'bg-slate-100 text-slate-900 rounded-bl-md'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Loading indicator for bot response */}
        {isSending && (
          <div className="flex justify-start">
            <div className="flex items-start gap-2 max-w-[80%]">
              {chatbot.show_avatar !== false && chatbot.avatar_url ? (
                <img
                  src={chatbot.avatar_url}
                  alt={chatbot.name}
                  className="flex-shrink-0 w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                  <Bot size={16} className="text-slate-600" />
                </div>
              )}
              <div className="px-4 py-3 bg-slate-100 rounded-2xl rounded-bl-md">
                <Loader2 size={18} className="animate-spin text-slate-500" />
              </div>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-200 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4 bg-white">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chatbots.conversation.inputPlaceholder', { botName: chatbot.name })}
            disabled={isSending}
            className="flex-1 px-4 py-3 sm:py-2.5 border border-slate-200 rounded-full focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isSending}
            className="p-3 sm:p-2.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatbotConversation;
