// ============================================================================
// MESSAGE INPUT COMPONENT
// Text input with send button for composing messages
// ============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Loader2 } from 'lucide-react';

interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}

const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  disabled = false,
  placeholder,
  maxLength = 2000,
}) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSend = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isSending || disabled) return;

    setIsSending(true);
    try {
      await onSend(trimmedMessage);
      setMessage('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send, Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isOverLimit = message.length > maxLength;
  const remainingChars = maxLength - message.length;
  const showCharCount = message.length > maxLength * 0.8;

  return (
    <div className="border-t border-[#1F1F1F] bg-[#0A0A0A] p-3">
      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || t('directMessages.input.placeholder')}
            disabled={disabled || isSending}
            rows={1}
            className={`w-full px-3 py-2 bg-[#0A0A0A] border rounded-lg text-sm resize-none focus:ring-1 focus:ring-white/10 focus:border-[#555555] transition-colors
              ${isOverLimit ? 'border-[#EF4444]/30 focus:ring-[#EF4444]/20' : 'border-[#1F1F1F]'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          />
          {showCharCount && (
            <span
              className={`absolute bottom-1 right-2 text-xs ${
                isOverLimit ? 'text-[#EF4444]' : 'text-[#666666]'
              }`}
            >
              {remainingChars}
            </span>
          )}
        </div>
        <button
          onClick={handleSend}
          disabled={!message.trim() || isSending || disabled || isOverLimit}
          className="shrink-0 p-2.5 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] rounded-lg hover:bg-[#E0E0E0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title={t('directMessages.input.sendButton')}
        >
          {isSending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>
      <p className="text-xs text-[#666666] mt-1.5 px-1">
        {t('directMessages.input.hint')}
      </p>
    </div>
  );
};

export default MessageInput;
