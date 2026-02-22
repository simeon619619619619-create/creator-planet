// ============================================================================
// PAYOUT HISTORY COMPONENT
// Displays table of past payouts with status badges
// ============================================================================

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  ArrowDownToLine,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { formatAmount } from '../stripeService';

// ============================================================================
// TYPES
// ============================================================================

export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type PayoutType = 'automatic' | 'manual';

export interface Payout {
  id: string;
  amount_cents: number;
  currency: string;
  type: PayoutType;
  status: PayoutStatus;
  stripe_transfer_id: string | null;
  failure_message: string | null;
  created_at: string;
  completed_at: string | null;
  failed_at: string | null;
}

export interface PayoutHistoryProps {
  payouts: Payout[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const PayoutHistory: React.FC<PayoutHistoryProps> = ({
  payouts,
  isLoading = false,
  onRefresh,
}) => {
  const { t } = useTranslation();

  // Status badge configuration
  const getStatusConfig = (status: PayoutStatus) => {
    switch (status) {
      case 'completed':
        return {
          icon: <CheckCircle size={14} />,
          bg: 'bg-green-100',
          text: 'text-green-700',
          label: t('billing.payoutHistory.status.completed'),
        };
      case 'processing':
        return {
          icon: <Loader2 size={14} className="animate-spin" />,
          bg: 'bg-blue-100',
          text: 'text-blue-700',
          label: t('billing.payoutHistory.status.processing'),
        };
      case 'pending':
        return {
          icon: <Clock size={14} />,
          bg: 'bg-amber-100',
          text: 'text-amber-700',
          label: t('billing.payoutHistory.status.pending'),
        };
      case 'failed':
        return {
          icon: <XCircle size={14} />,
          bg: 'bg-red-100',
          text: 'text-red-700',
          label: t('billing.payoutHistory.status.failed'),
        };
      default:
        return {
          icon: <Clock size={14} />,
          bg: 'bg-slate-100',
          text: 'text-slate-700',
          label: status,
        };
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <ArrowDownToLine size={20} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {t('billing.payoutHistory.title')}
            </h2>
            <p className="text-slate-500 text-sm">
              {t('billing.payoutHistory.subtitle')}
            </p>
          </div>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            title={t('billing.payoutHistory.refresh')}
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      {/* Loading State */}
      {isLoading && payouts.length === 0 && (
        <div className="text-center py-8">
          <Loader2 size={24} className="text-slate-400 animate-spin mx-auto mb-2" />
          <p className="text-slate-500">{t('billing.payoutHistory.loading')}</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && payouts.length === 0 && (
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <ArrowDownToLine size={24} className="text-slate-400" />
          </div>
          <p className="text-slate-500">{t('billing.payoutHistory.empty')}</p>
          <p className="text-slate-400 text-sm mt-1">
            {t('billing.payoutHistory.emptySubtitle')}
          </p>
        </div>
      )}

      {/* Payout Table */}
      {payouts.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-2 text-sm font-medium text-slate-500">
                  {t('billing.payoutHistory.columnDate')}
                </th>
                <th className="text-left py-3 px-2 text-sm font-medium text-slate-500">
                  {t('billing.payoutHistory.columnType')}
                </th>
                <th className="text-left py-3 px-2 text-sm font-medium text-slate-500">
                  {t('billing.payoutHistory.columnAmount')}
                </th>
                <th className="text-left py-3 px-2 text-sm font-medium text-slate-500">
                  {t('billing.payoutHistory.columnStatus')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payouts.map((payout) => {
                const statusConfig = getStatusConfig(payout.status);
                return (
                  <tr key={payout.id} className="hover:bg-slate-50">
                    <td className="py-4 px-2">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" />
                        <span className="text-sm text-slate-900">
                          {formatDate(payout.created_at)}
                        </span>
                      </div>
                      {payout.completed_at && (
                        <p className="text-xs text-slate-400 ml-6">
                          {t('billing.payoutHistory.completedAt', {
                            date: formatDateTime(payout.completed_at),
                          })}
                        </p>
                      )}
                      {payout.failed_at && (
                        <p className="text-xs text-red-400 ml-6">
                          {t('billing.payoutHistory.failedAt', {
                            date: formatDateTime(payout.failed_at),
                          })}
                        </p>
                      )}
                    </td>
                    <td className="py-4 px-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        payout.type === 'automatic'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {payout.type === 'automatic'
                          ? t('billing.payoutHistory.typeAutomatic')
                          : t('billing.payoutHistory.typeManual')}
                      </span>
                    </td>
                    <td className="py-4 px-2">
                      <span className="font-medium text-slate-900">
                        {formatAmount(payout.amount_cents, payout.currency)}
                      </span>
                    </td>
                    <td className="py-4 px-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}
                      >
                        {statusConfig.icon}
                        {statusConfig.label}
                      </span>
                      {payout.status === 'failed' && payout.failure_message && (
                        <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={payout.failure_message}>
                          {payout.failure_message}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PayoutHistory;
