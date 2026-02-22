// ============================================================================
// WITHDRAWAL MODAL COMPONENT
// Confirmation modal for manual withdrawal requests
// ============================================================================

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wallet,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { formatAmount } from '../stripeService';

// ============================================================================
// TYPES
// ============================================================================

export interface WithdrawalBlocker {
  reason: 'COOLDOWN_ACTIVE' | 'BELOW_MINIMUM' | 'CONNECT_NOT_ACTIVE' | 'NEGATIVE_BALANCE';
  message: string;
  cooldownEndsAt?: string;
  currentAmount?: number;
  minimumAmount?: number;
}

export interface WithdrawalResult {
  success: boolean;
  payout?: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    transferId: string;
  };
  error?: string;
}

export interface WithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<WithdrawalResult>;
  availableAmount: number;
  withdrawableAmount: number;
  negativeBalance: number;
  isEligible: boolean;
  blocker: WithdrawalBlocker | null;
  onSetupConnect?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const WithdrawalModal: React.FC<WithdrawalModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  availableAmount,
  withdrawableAmount,
  negativeBalance,
  isEligible,
  blocker,
  onSetupConnect,
}) => {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<WithdrawalResult | null>(null);

  if (!isOpen) return null;

  // Format cooldown time remaining
  const getCooldownTimeRemaining = () => {
    if (!blocker?.cooldownEndsAt) return null;
    const endsAt = new Date(blocker.cooldownEndsAt);
    const now = new Date();
    const hoursRemaining = Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60)));
    if (hoursRemaining >= 24) {
      const days = Math.floor(hoursRemaining / 24);
      const hours = hoursRemaining % 24;
      return `${days}d ${hours}h`;
    }
    return `${hoursRemaining}h`;
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      const withdrawalResult = await onConfirm();
      setResult(withdrawalResult);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Withdrawal failed',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  // Success State
  if (result?.success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
        <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              {t('billing.withdrawal.successTitle')}
            </h2>
            <p className="text-slate-600 mb-4">
              {t('billing.withdrawal.successMessage', {
                amount: formatAmount(result.payout?.amount || withdrawableAmount),
              })}
            </p>
            <div className="p-4 bg-slate-50 rounded-lg mb-6">
              <p className="text-sm text-slate-500 mb-1">
                {t('billing.withdrawal.transferId')}
              </p>
              <p className="font-mono text-sm text-slate-700">
                {result.payout?.transferId}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-full py-2.5 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (result && !result.success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
        <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle size={32} className="text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              {t('billing.withdrawal.errorTitle')}
            </h2>
            <p className="text-slate-600 mb-6">
              {result.error || t('billing.withdrawal.errorMessage')}
            </p>
            <button
              onClick={handleClose}
              className="w-full py-2.5 px-4 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Confirmation / Blocker State
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
            <Wallet size={20} className="text-indigo-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">
            {t('billing.withdrawal.modalTitle')}
          </h2>
        </div>

        {/* Amount Summary */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600">{t('billing.withdrawal.availableBalance')}</span>
            <span className="font-medium text-slate-900">{formatAmount(availableAmount)}</span>
          </div>
          {negativeBalance > 0 && (
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-red-600">{t('billing.withdrawal.negativeDeduction')}</span>
              <span className="font-medium text-red-600">-{formatAmount(negativeBalance)}</span>
            </div>
          )}
          <div className="flex justify-between items-center py-3 bg-green-50 rounded-lg px-3">
            <span className="font-medium text-slate-900">{t('billing.withdrawal.withdrawAmount')}</span>
            <span className="text-xl font-bold text-green-700">{formatAmount(withdrawableAmount)}</span>
          </div>
        </div>

        {/* Blocker Message */}
        {!isEligible && blocker && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              {blocker.reason === 'COOLDOWN_ACTIVE' ? (
                <Clock size={20} className="text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-medium text-amber-800">
                  {blocker.reason === 'COOLDOWN_ACTIVE' && t('billing.withdrawal.blockerCooldownTitle')}
                  {blocker.reason === 'BELOW_MINIMUM' && t('billing.withdrawal.blockerMinimumTitle')}
                  {blocker.reason === 'CONNECT_NOT_ACTIVE' && t('billing.withdrawal.blockerConnectTitle')}
                  {blocker.reason === 'NEGATIVE_BALANCE' && t('billing.withdrawal.blockerNegativeTitle')}
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  {blocker.reason === 'COOLDOWN_ACTIVE' && getCooldownTimeRemaining() && (
                    t('billing.withdrawal.blockerCooldownMessage', { time: getCooldownTimeRemaining() })
                  )}
                  {blocker.reason === 'BELOW_MINIMUM' && (
                    t('billing.withdrawal.blockerMinimumMessage', {
                      current: formatAmount(blocker.currentAmount || 0),
                      minimum: formatAmount(blocker.minimumAmount || 5000),
                    })
                  )}
                  {blocker.reason === 'CONNECT_NOT_ACTIVE' && (
                    t('billing.withdrawal.blockerConnectMessage')
                  )}
                  {blocker.reason === 'NEGATIVE_BALANCE' && (
                    t('billing.withdrawal.blockerNegativeMessage')
                  )}
                </p>
                {blocker.reason === 'CONNECT_NOT_ACTIVE' && onSetupConnect && (
                  <button
                    onClick={onSetupConnect}
                    className="mt-3 text-sm font-medium text-amber-800 underline hover:no-underline flex items-center gap-1"
                  >
                    {t('billing.withdrawal.setupConnectButton')}
                    <ExternalLink size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Processing Info */}
        {isEligible && (
          <div className="mb-6 p-3 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600">
              {t('billing.withdrawal.processingInfo')}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="flex-1 py-2.5 px-4 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isEligible || isProcessing}
            className={`flex-1 py-2.5 px-4 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
              isEligible && !isProcessing
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {t('billing.withdrawal.processing')}
              </>
            ) : (
              t('billing.withdrawal.confirmButton')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WithdrawalModal;
