import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, Trash2, Bot, AlertTriangle, Image, EyeOff, Upload } from 'lucide-react';
import { DbCommunityChatbot } from '../../core/supabase/database.types';
import { getRoleDefaults, ChatbotRole, uploadChatbotAvatar } from './chatbotService';

interface ChatbotEditModalProps {
  chatbot?: DbCommunityChatbot | null; // null for create mode
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    role: 'qa' | 'motivation' | 'support';
    systemPrompt: string;
    personality: string;
    greetingMessage: string;
    avatarUrl: string | null;
    showAvatar: boolean;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}

const ChatbotEditModal: React.FC<ChatbotEditModalProps> = ({
  chatbot,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  const { t } = useTranslation();
  const isEditMode = !!chatbot;

  const ROLE_OPTIONS: { value: ChatbotRole; label: string; emoji: string }[] = [
    { value: 'qa', label: t('chatbots.editModal.roles.qa'), emoji: '🤖' },
    { value: 'motivation', label: t('chatbots.editModal.roles.motivation'), emoji: '💪' },
    { value: 'support', label: t('chatbots.editModal.roles.support'), emoji: '🛠️' },
  ];

  // Form state
  const [name, setName] = useState('');
  const [role, setRole] = useState<ChatbotRole>('qa');
  const [personality, setPersonality] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [greetingMessage, setGreetingMessage] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [showAvatar, setShowAvatar] = useState(true);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form values when modal opens or chatbot changes
  useEffect(() => {
    if (isOpen) {
      if (chatbot) {
        // Edit mode - populate with existing chatbot data
        setName(chatbot.name);
        setRole(chatbot.role);
        setPersonality(chatbot.personality || '');
        setSystemPrompt(chatbot.system_prompt || '');
        setGreetingMessage(chatbot.greeting_message || '');
        setAvatarUrl(chatbot.avatar_url || '');
        setShowAvatar(chatbot.show_avatar ?? true);
      } else {
        // Create mode - use defaults for initial role
        const defaults = getRoleDefaults('qa');
        setName('');
        setRole('qa');
        setPersonality(defaults.personality);
        setSystemPrompt(defaults.systemPrompt);
        setGreetingMessage(defaults.greeting);
        setAvatarUrl('');
        setShowAvatar(true);
      }
      setErrorMessage(null);
      setShowDeleteConfirm(false);
    }
  }, [isOpen, chatbot]);

  // Handle role change in create mode - update fields to role defaults
  const handleRoleChange = (newRole: ChatbotRole) => {
    setRole(newRole);

    // Only auto-populate defaults in create mode
    if (!isEditMode) {
      const defaults = getRoleDefaults(newRole);
      setPersonality(defaults.personality);
      setSystemPrompt(defaults.systemPrompt);
      setGreetingMessage(defaults.greeting);
    }
  };

  // Handle avatar file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setErrorMessage(t('chatbots.editModal.fields.avatar.uploadError.invalidFile'));
      return;
    }

    // Validate file size (10MB max for chatbot avatars)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage(t('chatbots.editModal.fields.avatar.uploadError.fileSize'));
      return;
    }

    // For new chatbots, we need to save first to get an ID
    // For existing chatbots, upload directly
    if (!chatbot?.id) {
      setErrorMessage(t('chatbots.editModal.fields.avatar.uploadError.saveFirst'));
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const publicUrl = await uploadChatbotAvatar(chatbot.id, file);
      setAvatarUrl(publicUrl);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setErrorMessage(t('chatbots.editModal.fields.avatar.uploadError.failed'));
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = async () => {
    setErrorMessage(null);

    // Validation
    if (!name.trim()) {
      setErrorMessage(t('chatbots.editModal.validation.nameRequired'));
      return;
    }

    if (!systemPrompt.trim()) {
      setErrorMessage(t('chatbots.editModal.validation.systemPromptRequired'));
      return;
    }

    setIsSaving(true);

    try {
      await onSave({
        name: name.trim(),
        role,
        systemPrompt: systemPrompt.trim(),
        personality: personality.trim(),
        greetingMessage: greetingMessage.trim(),
        avatarUrl: avatarUrl.trim() || null,
        showAvatar,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t('chatbots.editModal.errors.saveFailed')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t('chatbots.editModal.errors.deleteFailed')
      );
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#0A0A0A] rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1F1F1F]">
          <div className="flex items-center gap-2">
            <Bot size={20} className="text-[#FAFAFA]" />
            <h3 className="text-lg font-semibold text-[#FAFAFA]">
              {isEditMode ? t('chatbots.editModal.titleEdit') : t('chatbots.editModal.titleCreate')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#1F1F1F] rounded-lg transition-colors"
          >
            <X size={20} className="text-[#666666]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Error Message */}
          {errorMessage && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] px-4 py-2 rounded-lg text-sm">
              {errorMessage}
            </div>
          )}

          {/* Bot Name */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-1">
              {t('chatbots.editModal.fields.name.label')} <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
              placeholder={t('chatbots.editModal.fields.name.placeholder')}
            />
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-2">
              {t('chatbots.editModal.fields.role.label')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ROLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleRoleChange(option.value)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                    role === option.value
                      ? 'border-[#555555] bg-[#1F1F1F] text-[#FAFAFA]'
                      : 'border-[#1F1F1F] hover:border-[#333333] text-[#A0A0A0]'
                  }`}
                >
                  <span className="text-2xl">{option.emoji}</span>
                  <span className="text-xs font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Personality */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-1">
              {t('chatbots.editModal.fields.personality')}
            </label>
            <input
              type="text"
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              className="w-full px-4 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
              placeholder={t('chatbots.editModal.fields.personalityPlaceholder')}
            />
            <p className="text-xs text-[#666666] mt-1">
              {t('chatbots.editModal.fields.personalityHint')}
            </p>
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-1">
              {t('chatbots.editModal.fields.systemPrompt')} <span className="text-[#EF4444]">*</span>
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full px-4 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555] h-28 resize-none"
              placeholder={t('chatbots.editModal.fields.systemPromptPlaceholder')}
            />
            <p className="text-xs text-[#666666] mt-1">
              {t('chatbots.editModal.fields.systemPromptHint')}
            </p>
          </div>

          {/* Greeting Message */}
          <div>
            <label className="block text-sm font-medium text-[#A0A0A0] mb-1">
              {t('chatbots.editModal.fields.greetingMessage')}
            </label>
            <textarea
              value={greetingMessage}
              onChange={(e) => setGreetingMessage(e.target.value)}
              className="w-full px-4 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555] h-20 resize-none"
              placeholder={t('chatbots.editModal.fields.greetingPlaceholder')}
            />
            <p className="text-xs text-[#666666] mt-1">
              {t('chatbots.editModal.fields.greetingHint')}
            </p>
          </div>

          {/* Avatar Settings */}
          <div className="border-t border-[#1F1F1F] pt-4">
            <label className="block text-sm font-medium text-[#A0A0A0] mb-3">
              {t('chatbots.editModal.fields.avatar.label')}
            </label>

            {/* Show Avatar Toggle */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {showAvatar ? (
                  <Image size={16} className="text-[#666666]" />
                ) : (
                  <EyeOff size={16} className="text-[#666666]" />
                )}
                <span className="text-sm text-[#A0A0A0]">
                  {t('chatbots.editModal.fields.avatar.showAvatar')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAvatar(!showAvatar)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showAvatar ? 'bg-white' : 'bg-[#1F1F1F]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-[#0A0A0A] transition-transform ${
                    showAvatar ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Avatar Input (only shown if showAvatar is true) */}
            {showAvatar && (
              <div className="space-y-3">
                {/* Avatar Preview + Upload Button */}
                <div className="flex items-center gap-4">
                  {/* Avatar Preview */}
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-[#1F1F1F] border-2 border-[#1F1F1F] flex items-center justify-center overflow-hidden">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.parentElement?.querySelector('.emoji-fallback');
                            if (fallback) fallback.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <span className={`emoji-fallback text-2xl ${avatarUrl ? 'hidden' : ''}`}>
                        {ROLE_OPTIONS.find(r => r.value === role)?.emoji || '🤖'}
                      </span>
                    </div>
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                        <Loader2 size={20} className="animate-spin text-white" />
                      </div>
                    )}
                  </div>

                  {/* Upload Button (only in edit mode) */}
                  <div className="flex-1 space-y-2">
                    {isEditMode && (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#FAFAFA] bg-[#1F1F1F] hover:bg-[#1F1F1F] rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Upload size={16} />
                          {t('chatbots.editModal.fields.avatar.uploadButton')}
                        </button>
                        <p className="text-xs text-[#666666]">
                          {t('chatbots.editModal.fields.avatar.uploadFormats')}
                        </p>
                      </>
                    )}
                    {!isEditMode && (
                      <p className="text-xs text-[#666666] italic">
                        {t('chatbots.editModal.fields.avatar.uploadAfterCreate')}
                      </p>
                    )}
                  </div>
                </div>

                {/* URL Input */}
                <div>
                  <label className="block text-xs text-[#666666] mb-1">
                    {t('chatbots.editModal.fields.avatar.orEnterUrl')}
                  </label>
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
                    placeholder={t('chatbots.editModal.fields.avatar.urlPlaceholder')}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Delete Section (only in edit mode) */}
        {isEditMode && onDelete && (
          <div className="p-4 border-t border-[#1F1F1F] bg-[#0A0A0A]">
            {showDeleteConfirm ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#EF4444]">
                  <AlertTriangle size={18} />
                  <span className="text-sm font-medium">{t('chatbots.editModal.delete.confirm')}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-sm text-[#A0A0A0] hover:bg-[#1F1F1F] rounded-lg"
                    disabled={isDeleting}
                  >
                    {t('chatbots.editModal.buttons.cancel')}
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-3 py-1.5 text-sm bg-[#EF4444] text-white rounded-lg hover:bg-[#DC2626] disabled:opacity-50 flex items-center gap-1"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        {t('chatbots.editModal.delete.deleting')}
                      </>
                    ) : (
                      t('chatbots.editModal.delete.confirmButton')
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-sm text-[#EF4444] hover:text-[#EF4444] flex items-center gap-1"
              >
                <Trash2 size={14} />
                {t('chatbots.editModal.delete.button')}
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 p-4 border-t border-[#1F1F1F]">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-[#1F1F1F] rounded-lg hover:bg-[#0A0A0A] font-medium text-[#A0A0A0]"
          >
            {t('chatbots.editModal.buttons.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !systemPrompt.trim() || isSaving}
            className="flex-1 bg-white text-black px-4 py-2 rounded-lg hover:bg-[#E0E0E0] disabled:opacity-50 font-medium flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {t('chatbots.editModal.buttons.saving')}
              </>
            ) : isEditMode ? (
              t('chatbots.editModal.buttons.save')
            ) : (
              t('chatbots.editModal.buttons.create')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatbotEditModal;
