import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, AlertTriangle, Trash2, XCircle } from 'lucide-react';

export type ConfirmModalVariant = 'danger' | 'warning' | 'info';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  variant?: ConfirmModalVariant;
  icon?: React.ReactNode;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  isLoading = false,
  variant = 'danger',
  icon,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  // Variant-based styling
  const variantConfig = {
    danger: {
      iconBg: 'bg-[#EF4444]/10',
      iconColor: 'text-[#EF4444]',
      buttonBg: 'bg-transparent text-[#EF4444] border border-[#EF4444]/20 hover:bg-[#EF4444]/10',
      defaultIcon: <Trash2 size={20} />,
    },
    warning: {
      iconBg: 'bg-[#EAB308]/10',
      iconColor: 'text-[#EAB308]',
      buttonBg: 'bg-transparent text-[#EAB308] border border-[#EAB308]/20 hover:bg-[#EAB308]/10',
      defaultIcon: <AlertTriangle size={20} />,
    },
    info: {
      iconBg: 'bg-[#1F1F1F]',
      iconColor: 'text-[var(--fc-text,#FAFAFA)]',
      buttonBg: 'bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] hover:bg-[#E0E0E0]',
      defaultIcon: <XCircle size={20} />,
    },
  };

  const config = variantConfig[variant];
  const displayIcon = icon || config.defaultIcon;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-[var(--fc-surface,#0A0A0A)] border border-[var(--fc-border,#1F1F1F)] rounded-xl max-w-md w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--fc-border,#1F1F1F)]">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${config.iconBg} ${config.iconColor} flex items-center justify-center`}>
              {displayIcon}
            </div>
            <h2 className="text-lg font-semibold text-[var(--fc-text,#FAFAFA)]">{title}</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 text-[var(--fc-muted,#666666)] hover:text-[var(--fc-text,#FAFAFA)] hover:bg-[#151515] rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-[var(--fc-muted,#A0A0A0)] leading-relaxed">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-[var(--fc-border,#1F1F1F)]">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 bg-transparent border border-[var(--fc-border,#1F1F1F)] text-[var(--fc-text,#FAFAFA)] hover:bg-[#151515] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {cancelLabel || t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${config.buttonBg}`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('common.loading')}
              </>
            ) : (
              confirmLabel || t('common.confirm')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
