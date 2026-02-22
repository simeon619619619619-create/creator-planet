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
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {t('publicCommunities.apply.title', { communityName })}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-sm text-slate-600">
            {t('publicCommunities.apply.description', { communityName })}
          </p>

          <div>
            <label
              htmlFor="message"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              {t('publicCommunities.apply.messageLabel')}
              <span className="text-slate-400 font-normal ml-1">
                ({t('common.optional')})
              </span>
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('publicCommunities.apply.messagePlaceholder')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                resize-none"
              rows={4}
              maxLength={500}
              disabled={isSubmitting}
            />
            <p className="text-xs text-slate-400 mt-1 text-right">
              {message.length}/500
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100
                hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600
                hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50
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
