import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Plus, ToggleLeft, ToggleRight, Pencil, Loader2 } from 'lucide-react';
import { DbCommunityChatbot } from '../../core/supabase/database.types';
import {
  getChatbots,
  createChatbot,
  updateChatbot,
  deleteChatbot,
  ChatbotRole,
} from './chatbotService';
import ChatbotEditModal from './ChatbotEditModal';

interface ChatbotSettingsProps {
  communityId: string;
}

const MAX_CHATBOTS = 3;

const ChatbotSettings: React.FC<ChatbotSettingsProps> = ({ communityId }) => {
  const { t } = useTranslation();

  // Role display configuration
  const ROLE_CONFIG: Record<ChatbotRole, { emoji: string; label: string }> = {
    qa: { emoji: '🤖', label: t('chatbots.settings.roles.qa') },
    motivation: { emoji: '💪', label: t('chatbots.settings.roles.motivation') },
    support: { emoji: '🛠️', label: t('chatbots.settings.roles.support') },
  };
  const [chatbots, setChatbots] = useState<DbCommunityChatbot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChatbot, setEditingChatbot] = useState<DbCommunityChatbot | null>(null);

  // Load chatbots on mount
  useEffect(() => {
    loadChatbots();
  }, [communityId]);

  const loadChatbots = async () => {
    setIsLoading(true);
    try {
      const data = await getChatbots(communityId);
      setChatbots(data);
    } catch (error) {
      console.error('Error loading chatbots:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle creating a new chatbot
  const handleCreate = () => {
    setEditingChatbot(null);
    setIsModalOpen(true);
  };

  // Handle editing an existing chatbot
  const handleEdit = (chatbot: DbCommunityChatbot) => {
    setEditingChatbot(chatbot);
    setIsModalOpen(true);
  };

  // Handle toggling active state
  const handleToggleActive = async (chatbot: DbCommunityChatbot) => {
    setTogglingId(chatbot.id);
    try {
      const updated = await updateChatbot(chatbot.id, {
        is_active: !chatbot.is_active,
      });
      if (updated) {
        setChatbots((prev) =>
          prev.map((c) => (c.id === chatbot.id ? { ...c, is_active: !c.is_active } : c))
        );
      }
    } catch (error) {
      console.error('Error toggling chatbot:', error);
    } finally {
      setTogglingId(null);
    }
  };

  // Handle save from modal (create or update)
  const handleSave = async (data: {
    name: string;
    role: ChatbotRole;
    systemPrompt: string;
    personality: string;
    greetingMessage: string;
    avatarUrl: string | null;
    showAvatar: boolean;
  }) => {
    if (editingChatbot) {
      // Update existing chatbot
      const updated = await updateChatbot(editingChatbot.id, {
        name: data.name,
        role: data.role,
        system_prompt: data.systemPrompt,
        personality: data.personality,
        greeting_message: data.greetingMessage,
        avatar_url: data.avatarUrl,
        show_avatar: data.showAvatar,
      });
      if (updated) {
        setChatbots((prev) => prev.map((c) => (c.id === editingChatbot.id ? updated : c)));
        setIsModalOpen(false);
      } else {
        throw new Error('Failed to update chatbot');
      }
    } else {
      // Create new chatbot
      const created = await createChatbot(
        communityId,
        data.name,
        data.role,
        data.systemPrompt,
        data.personality,
        data.greetingMessage
      );
      if (created) {
        setChatbots((prev) => [...prev, created]);
        setIsModalOpen(false);
      } else {
        throw new Error('Failed to create chatbot');
      }
    }
  };

  // Handle delete from modal
  const handleDelete = async () => {
    if (!editingChatbot) return;

    const success = await deleteChatbot(editingChatbot.id);
    if (success) {
      setChatbots((prev) => prev.filter((c) => c.id !== editingChatbot.id));
      setIsModalOpen(false);
    } else {
      throw new Error('Failed to delete chatbot');
    }
  };

  // Close modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingChatbot(null);
  };

  const canAddMore = chatbots.length < MAX_CHATBOTS;

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-slate-900">{t('chatbots.settings.title')}</h3>
        </div>
        {canAddMore && (
          <button
            onClick={handleCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} />
            {t('chatbots.settings.addBot')}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {chatbots.length === 0 ? (
          // Empty State
          <div className="py-12 text-center">
            <Bot className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-medium text-slate-900 mb-1">{t('chatbots.settings.emptyState.title')}</h4>
            <p className="text-sm text-slate-500 mb-4">
              {t('chatbots.settings.emptyState.description', { count: MAX_CHATBOTS })}
            </p>
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} />
              {t('chatbots.settings.emptyState.addFirst')}
            </button>
          </div>
        ) : (
          // Chatbot List
          <div className="space-y-3">
            {chatbots.map((chatbot) => {
              const roleConfig = ROLE_CONFIG[chatbot.role] || ROLE_CONFIG.qa;
              const isToggling = togglingId === chatbot.id;

              return (
                <div
                  key={chatbot.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100"
                >
                  {/* Chatbot Info */}
                  <div className="flex items-center gap-3">
                    {/* Avatar - show custom image or emoji fallback */}
                    {chatbot.show_avatar !== false ? (
                      chatbot.avatar_url ? (
                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-slate-100">
                          <img
                            src={chatbot.avatar_url}
                            alt={chatbot.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const fallback = e.currentTarget.parentElement?.querySelector('.emoji-fallback');
                              if (fallback) fallback.classList.remove('hidden');
                            }}
                          />
                          <span className="emoji-fallback hidden text-2xl flex items-center justify-center w-full h-full">
                            {roleConfig.emoji}
                          </span>
                        </div>
                      ) : (
                        <span className="text-2xl">{roleConfig.emoji}</span>
                      )
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Bot size={20} className="text-slate-400" />
                      </div>
                    )}
                    <div>
                      <h4 className="font-medium text-slate-900">{chatbot.name}</h4>
                      <p className="text-sm text-slate-500">{roleConfig.label}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    {/* Active Toggle */}
                    <button
                      onClick={() => handleToggleActive(chatbot)}
                      disabled={isToggling}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium transition-colors ${
                        chatbot.is_active
                          ? 'text-green-700 bg-green-50 hover:bg-green-100'
                          : 'text-slate-500 bg-slate-100 hover:bg-slate-200'
                      } ${isToggling ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={chatbot.is_active ? t('chatbots.settings.tooltips.deactivate') : t('chatbots.settings.tooltips.activate')}
                    >
                      {isToggling ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : chatbot.is_active ? (
                        <ToggleRight size={18} />
                      ) : (
                        <ToggleLeft size={18} />
                      )}
                      <span>{chatbot.is_active ? t('chatbots.settings.status.active') : t('chatbots.settings.status.inactive')}</span>
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => handleEdit(chatbot)}
                      className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title={t('chatbots.settings.tooltips.edit')}
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Add more hint */}
            {canAddMore && (
              <p className="text-xs text-slate-400 text-center pt-2">
                {t('chatbots.settings.moreAvailable', { count: MAX_CHATBOTS - chatbots.length })}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <ChatbotEditModal
        chatbot={editingChatbot}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        onDelete={editingChatbot ? handleDelete : undefined}
      />
    </div>
  );
};

export default ChatbotSettings;
