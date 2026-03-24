import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Send, Loader2 } from 'lucide-react';

interface ApplyModalProps {
  communityName: string;
  onSubmit: (message: string) => Promise<void>;
  onClose: () => void;
  isSubmitting?: boolean;
}

export const ApplyModal: React.FC<ApplyModalProps> = ({
  communityName,
  onSubmit,
  onClose,
  isSubmitting = false,
}) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(message);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--fc-section-border,#1F1F1F)]">
          <h2 className="text-lg font-semibold text-[var(--fc-text,#FAFAFA)]">
            {t('publicCommunities.apply.title', { communityName })}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-text,#FAFAFA)] hover:bg-[var(--fc-section-hover,#151515)] rounded-full transition-colors duration-150"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-sm text-[var(--fc-section-muted,#A0A0A0)]">
            {t('publicCommunities.apply.description', { communityName })}
          </p>

          <div>
            <label
              htmlFor="message"
              className="block text-xs font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1"
            >
              {t('publicCommunities.apply.messageLabel')}
              <span className="text-[var(--fc-section-muted,#666666)] font-normal ml-1">
                ({t('common.optional')})
              </span>
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('publicCommunities.apply.messagePlaceholder')}
              className="w-full px-3 py-2 bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-lg text-sm text-[var(--fc-text,#FAFAFA)] placeholder-[#666666]
                focus:outline-none focus:border-[#555555] focus:ring-1 focus:ring-white/10
                resize-none transition-colors duration-150"
              rows={4}
              maxLength={500}
              disabled={isSubmitting}
            />
            <p className="text-xs text-[var(--fc-section-muted,#666666)] mt-1 text-right">
              {message.length}/500
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-[var(--fc-text,#FAFAFA)] bg-transparent
                border border-[var(--fc-section-border,#1F1F1F)] hover:bg-[var(--fc-section-hover,#151515)] hover:border-[#333333] rounded-lg transition-all duration-150 disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-black bg-white
                hover:bg-[#E0E0E0] rounded-lg transition-colors duration-150 disabled:opacity-50
                flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('publicCommunities.apply.submitting')}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {t('publicCommunities.apply.submit')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
