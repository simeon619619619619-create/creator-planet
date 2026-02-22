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
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      buttonBg: 'bg-red-600 hover:bg-red-700',
      defaultIcon: <Trash2 size={20} />,
    },
    warning: {
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      buttonBg: 'bg-amber-600 hover:bg-amber-700',
      defaultIcon: <AlertTriangle size={20} />,
    },
    info: {
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
      buttonBg: 'bg-indigo-600 hover:bg-indigo-700',
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
        className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${config.iconBg} ${config.iconColor} flex items-center justify-center`}>
              {displayIcon}
            </div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-slate-600 leading-relaxed">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 text-slate-600 hover:bg-slate-200 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {cancelLabel || t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2.5 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${config.buttonBg}`}
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
