import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useCommunity } from '../../../core/contexts/CommunityContext';
import AiResponseText from '../../../components/ui/AiResponseText';
import GhostWriterStatusPanel from './GhostWriterStatusPanel';
import GhostWriterDraftsList from './GhostWriterDraftsList';
import {
  getGhostWriterConfig,
  createGhostWriterConfig,
  updateGhostWriterConfig,
  toggleGhostWriter,
  getPendingDrafts,
} from '../ghostWriterService';
import {
  GHOST_WRITER_QUESTIONS,
  buildPersonaPrompt,
  extractConfigFromAnswers,
  parseScheduleFromAnswers,
} from '../ghostWriterOnboarding';
import { generateGhostPost } from '../ghostWriterAI';
import {
  getRecentConversation,
  saveConversation,
} from '../../ai-manager/conversationService';
import type { DbGhostWriterConfig, GhostWriterApprovalMode } from '../ghostWriterTypes';
import type { AIMessage, AIMessageRecord, AIConversation } from '../../../core/types';

const GhostWriterTab: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { selectedCommunity } = useCommunity();

  // Config
  const [config, setConfig] = useState<DbGhostWriterConfig | null>(null);
  const [draftsCount, setDraftsCount] = useState(0);

  // Chat
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Onboarding
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [onboardingAnswers, setOnboardingAnswers] = useState<Record<string, string | string[]>>({});

  // Conversation persistence
  const [currentConversation, setCurrentConversation] = useState<AIConversation | null>(null);
  const isMountedRef = useRef(true);
  const saveVersionRef = useRef(0);

  const communityId = selectedCommunity?.id;
  const creatorProfileId = profile?.id;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load config on mount
  useEffect(() => {
    if (!communityId || !creatorProfileId) return;

    const loadConfig = async () => {
      const cfg = await getGhostWriterConfig(communityId);
      setConfig(cfg);

      if (!cfg || !cfg.persona_prompt) {
        // No config or empty persona — start onboarding
        setIsOnboarding(true);
        setCurrentQuestionIndex(0);
        const firstQ = GHOST_WRITER_QUESTIONS[0];
        setMessages([
          {
            role: 'model',
            text: t('ghostWriter.onboarding.welcome', {
              defaultValue: 'Здравей! Ще те помоля да отговориш на няколко въпроса, за да настроя AI автора по твоя стил.',
            }),
            timestamp: new Date(),
          },
          {
            role: 'model',
            text: formatQuestion(firstQ.question, firstQ.options),
            timestamp: new Date(),
          },
        ]);
      } else {
        // Config exists — load recent conversation
        setIsOnboarding(false);
        const conversation = await getRecentConversation(creatorProfileId, 'ghost_writer');
        if (conversation && conversation.messages && conversation.messages.length > 0) {
          const loadedMessages: AIMessage[] = (conversation.messages as AIMessageRecord[]).map(
            (m) => ({
              role: m.role === 'assistant' ? ('model' as const) : (m.role as 'user' | 'model'),
              text: m.content,
              timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
            })
          );
          setMessages(loadedMessages);
          setCurrentConversation(conversation);
        } else {
          setMessages([
            {
              role: 'model',
              text: t('ghostWriter.chat.ready', {
                defaultValue:
                  'AI авторът е готов. Можеш да ме помолиш да напиша пост, да променя настройки или да генерирам съдържание.',
              }),
              timestamp: new Date(),
            },
          ]);
        }
      }

      // Load pending drafts count
      const pendingDrafts = await getPendingDrafts(communityId);
      setDraftsCount(pendingDrafts.length);
    };

    loadConfig();
  }, [communityId, creatorProfileId, t]);

  // Auto-save conversation (debounced)
  useEffect(() => {
    if (!creatorProfileId || messages.length <= 1 || isOnboarding) return;

    const currentVersion = ++saveVersionRef.current;

    const saveCurrentConversation = async () => {
      if (currentVersion !== saveVersionRef.current) return;
      if (!isMountedRef.current) return;

      const messagesToSave: AIMessageRecord[] = messages.map((m) => ({
        role: m.role === 'model' ? ('assistant' as const) : m.role,
        content: m.text,
        timestamp: m.timestamp.toISOString(),
      }));

      const saved = await saveConversation(
        creatorProfileId,
        'ghost_writer',
        messagesToSave,
        undefined,
        currentConversation?.id
      );

      if (isMountedRef.current && currentVersion === saveVersionRef.current) {
        if (saved && !currentConversation) {
          setCurrentConversation(saved);
        }
      }
    };

    const timeoutId = setTimeout(saveCurrentConversation, 2000);
    return () => clearTimeout(timeoutId);
  }, [messages, creatorProfileId, currentConversation, isOnboarding]);

  const formatQuestion = (question: string, options?: string[]): string => {
    if (!options || options.length === 0) return question;
    return `${question}\n\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`;
  };

  // Handle onboarding answer
  const handleOnboardingAnswer = async (userText: string) => {
    const currentQ = GHOST_WRITER_QUESTIONS[currentQuestionIndex];
    const newAnswers = { ...onboardingAnswers };

    // Parse answer
    if (currentQ.type === 'multi-choice' && currentQ.options) {
      // Try to match numbers or text
      const selected = userText
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const num = parseInt(s, 10);
          if (!isNaN(num) && num >= 1 && num <= (currentQ.options?.length ?? 0)) {
            return currentQ.options![num - 1];
          }
          return s;
        });
      newAnswers[currentQ.id] = selected;
    } else if (currentQ.type === 'choice' && currentQ.options) {
      const num = parseInt(userText.trim(), 10);
      if (!isNaN(num) && num >= 1 && num <= currentQ.options.length) {
        newAnswers[currentQ.id] = currentQ.options[num - 1];
      } else {
        newAnswers[currentQ.id] = userText.trim();
      }
    } else {
      newAnswers[currentQ.id] = userText.trim();
    }

    setOnboardingAnswers(newAnswers);

    const nextIndex = currentQuestionIndex + 1;

    if (nextIndex < GHOST_WRITER_QUESTIONS.length) {
      // Next question
      setCurrentQuestionIndex(nextIndex);
      const nextQ = GHOST_WRITER_QUESTIONS[nextIndex];
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: formatQuestion(nextQ.question, nextQ.options),
          timestamp: new Date(),
        },
      ]);
    } else {
      // Onboarding complete
      await completeOnboarding(newAnswers);
    }
  };

  const completeOnboarding = async (answers: Record<string, string | string[]>) => {
    if (!communityId || !creatorProfileId || !profile?.full_name) return;

    setIsLoading(true);

    const personaPrompt = buildPersonaPrompt(profile.full_name, answers);
    const configValues = extractConfigFromAnswers(answers);
    const schedule = parseScheduleFromAnswers(answers);

    let cfg = config;
    if (!cfg) {
      cfg = await createGhostWriterConfig(communityId, creatorProfileId);
    }

    if (cfg) {
      const updated = await updateGhostWriterConfig(cfg.id, {
        persona_prompt: personaPrompt,
        persona_answers: Object.entries(answers).map(([k, v]) => ({ question: k, answer: v })),
        approval_mode: configValues.approval_mode,
        auto_reply_enabled: configValues.auto_reply_enabled,
        data_collection_fields: configValues.data_collection_fields,
        post_schedule_description: schedule.description,
        is_active: true,
      });

      if (updated) {
        setConfig(updated);
      }
    }

    setMessages((prev) => [
      ...prev,
      {
        role: 'model',
        text: t('ghostWriter.onboarding.complete', {
          defaultValue:
            'Готово! Настроих AI автора по твоя стил. Сега можеш да ме помолиш да напиша пост, да променя настройки или нещо друго.',
        }),
        timestamp: new Date(),
      },
    ]);

    setIsOnboarding(false);
    setIsLoading(false);
  };

  // Handle normal chat
  const handleChatMessage = async (userText: string) => {
    if (!config || !communityId || !selectedCommunity) return;

    setIsLoading(true);

    // Check for post generation request
    const postKeywords = ['напиши пост', 'генерирай пост', 'създай пост', 'нов пост', 'пост за'];
    const isPostRequest = postKeywords.some((kw) => userText.toLowerCase().includes(kw));

    if (isPostRequest && config.persona_prompt) {
      try {
        const generatedPost = await generateGhostPost({
          personaPrompt: config.persona_prompt,
          postType: 'custom',
          topicHints: userText,
          communityName: selectedCommunity.name,
        });

        setMessages((prev) => [
          ...prev,
          {
            role: 'model',
            text: t('ghostWriter.chat.generatedPost', {
              defaultValue: 'Ето предложение за пост:\n\n---\n\n{{post}}\n\n---\n\nИскаш ли да го одобриш или да го променя?',
              post: generatedPost,
            }),
            timestamp: new Date(),
          },
        ]);
      } catch (error) {
        console.error('Error generating post:', error);
        setMessages((prev) => [
          ...prev,
          {
            role: 'model',
            text: t('ghostWriter.chat.error', {
              defaultValue: 'Възникна грешка при генерирането. Опитай отново.',
            }),
            timestamp: new Date(),
          },
        ]);
      }
    } else {
      // General chat response
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: t('ghostWriter.chat.generalResponse', {
            defaultValue:
              'Мога да ти помогна с:\n- "Напиши пост за [тема]" - генерирам пост\n- Промяна на настройки\n- Преглед на чакащи публикации\n\nКакво искаш да направя?',
          }),
          timestamp: new Date(),
        },
      ]);
    }

    setIsLoading(false);
  };

  const handleSend = async () => {
    if (!inputMessage.trim()) return;

    const userMsg: AIMessage = {
      role: 'user',
      text: inputMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    const text = inputMessage;
    setInputMessage('');

    if (isOnboarding) {
      await handleOnboardingAnswer(text);
    } else {
      await handleChatMessage(text);
    }
  };

  // Status panel handlers
  const handleToggleActive = async (isActive: boolean) => {
    if (!config) return;
    const updated = await toggleGhostWriter(config.id, isActive);
    if (updated) setConfig(updated);
  };

  const handleToggleAutoReply = async (enabled: boolean) => {
    if (!config) return;
    const updated = await updateGhostWriterConfig(config.id, {
      auto_reply_enabled: enabled,
    });
    if (updated) setConfig(updated);
  };

  const handleChangeApprovalMode = async (mode: GhostWriterApprovalMode) => {
    if (!config) return;
    const updated = await updateGhostWriterConfig(config.id, {
      approval_mode: mode,
    });
    if (updated) setConfig(updated);
  };

  const handleDraftPublished = async () => {
    if (!communityId) return;
    const pendingDrafts = await getPendingDrafts(communityId);
    setDraftsCount(pendingDrafts.length);
  };

  if (!communityId || !creatorProfileId) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--fc-section-muted,#666666)]">
        <p className="text-sm">
          {t('ghostWriter.noCommunity', { defaultValue: 'Избери общност, за да използваш AI автора.' })}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden gap-4">
      {/* Status Panel */}
      {!isOnboarding && (
        <GhostWriterStatusPanel
          config={config}
          onToggleActive={handleToggleActive}
          onToggleAutoReply={handleToggleAutoReply}
          onChangeApprovalMode={handleChangeApprovalMode}
          draftsCount={draftsCount}
        />
      )}

      {/* Chat Area */}
      <div className="flex-1 bg-[var(--fc-section,#0A0A0A)] rounded-xl border border-[var(--fc-section-border,#1F1F1F)] overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'model'
                    ? 'bg-[var(--fc-section-hover,#1F1F1F)] text-[var(--fc-section-text,#FAFAFA)]'
                    : 'bg-[var(--fc-section-hover,#1F1F1F)] text-[var(--fc-section-muted,#A0A0A0)]'
                }`}
              >
                {msg.role === 'model' ? <Bot size={18} /> : <User size={18} />}
              </div>
              <div
                className={`max-w-[70%] p-4 rounded-2xl ${
                  msg.role === 'model'
                    ? 'bg-[var(--fc-section-hover,#151515)] border border-[var(--fc-section-border,#1F1F1F)] text-[var(--fc-section-muted,#A0A0A0)] rounded-tl-none'
                    : 'bg-[#FAFAFA] text-black rounded-tr-none'
                }`}
              >
                {msg.role === 'model' ? (
                  <AiResponseText text={msg.text} />
                ) : (
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-[var(--fc-section-hover,#1F1F1F)] text-[var(--fc-section-text,#FAFAFA)] flex items-center justify-center shrink-0">
                <Bot size={18} />
              </div>
              <div className="bg-[var(--fc-section-hover,#151515)] border border-[var(--fc-section-border,#1F1F1F)] p-4 rounded-2xl rounded-tl-none flex gap-1">
                <span
                  className="w-2 h-2 bg-white rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className="w-2 h-2 bg-white rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="w-2 h-2 bg-white rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-4 bg-[var(--fc-section,#0A0A0A)] border-t border-[var(--fc-section-border,#1F1F1F)]">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={
                isOnboarding
                  ? t('ghostWriter.chat.onboardingPlaceholder', { defaultValue: 'Напиши отговор...' })
                  : t('ghostWriter.chat.placeholder', { defaultValue: 'Напиши съобщение...' })
              }
              className="flex-1 bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-lg px-4 py-2 text-[var(--fc-section-text,#FAFAFA)] placeholder:text-[var(--fc-section-muted,#666666)] focus:border-[var(--fc-section-text,#555555)] focus:ring-1 focus:ring-white/10 focus:outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!inputMessage.trim() || isLoading}
              className="bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] p-2 rounded-lg hover:bg-[var(--fc-button-hover,#E0E0E0)] disabled:opacity-50 transition-colors"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Drafts List */}
      {!isOnboarding && config && (
        <div className="border border-[var(--fc-section-border,#1F1F1F)] rounded-xl p-4 bg-[var(--fc-section,#0A0A0A)]">
          <GhostWriterDraftsList
            communityId={communityId}
            creatorProfileId={creatorProfileId}
            onDraftPublished={handleDraftPublished}
          />
        </div>
      )}
    </div>
  );
};

export default GhostWriterTab;
