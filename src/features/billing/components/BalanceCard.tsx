// ============================================================================
// BALANCE CARD COMPONENT
// Displays creator's wallet balance breakdown with pending/available/reserved
// ============================================================================

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wallet,
  Clock,
  Shield,
  AlertTriangle,
  TrendingUp,
  Info,
  Loader2,
} from 'lucide-react';
import { formatAmount } from '../stripeService';

// ============================================================================
// TYPES
// ============================================================================

export interface BalanceData {
  pending: number;         // Funds in 7-day hold
  available: number;       // Ready for withdrawal
  reserved: number;        // Rolling reserve (120 days)
  negative: number;        // Chargeback debt
  withdrawable: number;    // Amount that can be withdrawn
}

export interface NextRelease {
  date: string;
  amount: number;
}

export interface ReserveRelease {
  amount_cents: number;
  release_at: string;
}

export interface BalanceCardProps {
  balances: BalanceData;
  nextPendingRelease: NextRelease | null;
  reserveReleases: ReserveRelease[];
  connectStatus: string | null;
  isEligibleForWithdrawal: boolean;
  withdrawalBlocker?: {
    reason: string;
    message: string;
    cooldownEndsAt?: string;
  } | null;
  onWithdraw: () => void;
  isLoading?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

const BalanceCard: React.FC<BalanceCardProps> = ({
  balances,
  nextPendingRelease,
  reserveReleases,
  connectStatus,
  isEligibleForWithdrawal,
  withdrawalBlocker,
  onWithdraw,
  isLoading = false,
}) => {
  const { t } = useTranslation();

  // Calculate days until next pending release
  const daysUntilAvailable = nextPendingRelease
    ? Math.max(0, Math.ceil((new Date(nextPendingRelease.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  // Calculate total reserve and days until next release
  const nextReserveRelease = reserveReleases.length > 0 ? reserveReleases[0] : null;
  const daysUntilReserveRelease = nextReserveRelease
    ? Math.max(0, Math.ceil((new Date(nextReserveRelease.release_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  // Format cooldown time remaining
  const getCooldownTimeRemaining = () => {
    if (!withdrawalBlocker?.cooldownEndsAt) return null;
    const endsAt = new Date(withdrawalBlocker.cooldownEndsAt);
    const now = new Date();
    const hoursRemaining = Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60)));
    if (hoursRemaining >= 24) {
      const days = Math.floor(hoursRemaining / 24);
      const hours = hoursRemaining % 24;
      return `${days}d ${hours}h`;
    }
    return `${hoursRemaining}h`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {t('billing.balance.title')}
          </h2>
          <p className="text-slate-500 text-sm">
            {t('billing.balance.subtitle')}
          </p>
        </div>
        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
          <Wallet size={20} className="text-indigo-600" />
        </div>
      </div>

      {/* Balance Grid */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {/* Pending Balance */}
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={18} className="text-amber-600" />
            <span className="font-medium text-slate-900">
              {t('billing.balance.pending')}
            </span>
            <div className="group relative ml-auto">
              <Info size={14} className="text-slate-400 cursor-help" />
              <div className="hidden group-hover:block absolute right-0 top-6 w-48 p-2 bg-slate-800 text-white text-xs rounded shadow-lg z-10">
                {t('billing.balance.pendingTooltip')}
              </div>
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-700">
            {formatAmount(balances.pending)}
          </p>
          {nextPendingRelease && daysUntilAvailable !== null && (
            <p className="text-sm text-amber-600 mt-1">
              {t('billing.balance.availableInDays', { days: daysUntilAvailable })}
            </p>
          )}
        </div>

        {/* Available Balance */}
        <div className="p-4 bg-green-50 border border-green-100 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={18} className="text-green-600" />
            <span className="font-medium text-slate-900">
              {t('billing.balance.available')}
            </span>
          </div>
          <p className="text-2xl font-bold text-green-700">
            {formatAmount(balances.available)}
          </p>
          <p className="text-sm text-green-600 mt-1">
            {t('billing.balance.readyForWithdrawal')}
          </p>
        </div>

        {/* Reserved Balance */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={18} className="text-slate-600" />
            <span className="font-medium text-slate-900">
              {t('billing.balance.reserved')}
            </span>
            <div className="group relative ml-auto">
              <Info size={14} className="text-slate-400 cursor-help" />
              <div className="hidden group-hover:block absolute right-0 top-6 w-48 p-2 bg-slate-800 text-white text-xs rounded shadow-lg z-10">
                {t('billing.balance.reservedTooltip')}
              </div>
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-700">
            {formatAmount(balances.reserved)}
          </p>
          {nextReserveRelease && daysUntilReserveRelease !== null && (
            <p className="text-sm text-slate-500 mt-1">
              {t('billing.balance.releasedInDays', { days: daysUntilReserveRelease })}
            </p>
          )}
        </div>

        {/* Negative Balance (only show if > 0) */}
        {balances.negative > 0 && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={18} className="text-red-600" />
              <span className="font-medium text-red-900">
                {t('billing.balance.negative')}
              </span>
            </div>
            <p className="text-2xl font-bold text-red-700">
              -{formatAmount(balances.negative)}
            </p>
            <p className="text-sm text-red-600 mt-1">
              {t('billing.balance.negativeMessage')}
            </p>
          </div>
        )}
      </div>

      {/* Withdrawal Section */}
      <div className="border-t border-slate-200 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">
              {t('billing.balance.withdrawableAmount')}
            </p>
            <p className="text-xl font-bold text-slate-900">
              {formatAmount(balances.withdrawable)}
            </p>
          </div>
          <button
            onClick={onWithdraw}
            disabled={!isEligibleForWithdrawal || isLoading}
            className={`px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              isEligibleForWithdrawal && !isLoading
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {t('billing.withdrawal.processing')}
              </>
            ) : (
              t('billing.withdrawal.withdrawButton')
            )}
          </button>
        </div>

        {/* Withdrawal Blocker Message */}
        {withdrawalBlocker && !isEligibleForWithdrawal && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600">
              {withdrawalBlocker.reason === 'COOLDOWN_ACTIVE' && getCooldownTimeRemaining() ? (
                <>
                  {t('billing.withdrawal.cooldownMessage', { time: getCooldownTimeRemaining() })}
                </>
              ) : withdrawalBlocker.reason === 'BELOW_MINIMUM' ? (
                t('billing.withdrawal.minimumMessage')
              ) : withdrawalBlocker.reason === 'CONNECT_NOT_ACTIVE' ? (
                t('billing.withdrawal.connectMessage')
              ) : (
                withdrawalBlocker.message
              )}
            </p>
          </div>
        )}

        {/* Connect Not Setup Warning */}
        {connectStatus !== 'active' && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                {t('billing.withdrawal.setupConnectWarning')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BalanceCard;
