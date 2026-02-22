// =============================================================================
// PointsHistory Component
// Shows transaction history for loyalty points
// =============================================================================

import { useTranslation } from 'react-i18next';
import type { LoyaltyPointTransaction, PointTransactionType } from '../studentPlusTypes';

interface PointsHistoryProps {
  transactions: LoyaltyPointTransaction[];
  showLoadMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

const transactionTypeIcons: Record<PointTransactionType, string> = {
  subscription_payment: '💳',
  milestone_bonus: '🏆',
  referral: '🤝',
  engagement: '⭐',
  redemption: '🎁',
  adjustment: '🔧',
  expiration: '⏰',
};

export function PointsHistory({
  transactions,
  showLoadMore = false,
  onLoadMore,
  isLoadingMore = false,
}: PointsHistoryProps) {
  const { t } = useTranslation();

  const transactionTypeLabels: Record<PointTransactionType, string> = {
    subscription_payment: t('studentPlus.history.transactionTypes.subscriptionPayment'),
    milestone_bonus: t('studentPlus.history.transactionTypes.milestoneBonus'),
    referral: t('studentPlus.history.transactionTypes.referral'),
    engagement: t('studentPlus.history.transactionTypes.engagement'),
    redemption: t('studentPlus.history.transactionTypes.redemption'),
    adjustment: t('studentPlus.history.transactionTypes.adjustment'),
    expiration: t('studentPlus.history.transactionTypes.expiration'),
  };
  if (transactions.length === 0) {
    return null;
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-3">
      {transactions.map((tx) => (
        <div
          key={tx.id}
          className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{transactionTypeIcons[tx.transaction_type]}</span>
            <div>
              <div className="font-medium text-gray-900">
                {tx.description || transactionTypeLabels[tx.transaction_type]}
              </div>
              <div className="text-xs text-gray-500">{formatDate(tx.created_at)}</div>
            </div>
          </div>
          <div
            className={`font-semibold ${
              tx.points >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {tx.points >= 0 ? '+' : ''}
            {tx.points.toLocaleString()}
          </div>
        </div>
      ))}

      {showLoadMore && onLoadMore && (
        <button
          onClick={onLoadMore}
          disabled={isLoadingMore}
          className="w-full py-2 text-sm text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
        >
          {isLoadingMore ? t('studentPlus.history.loading') : t('studentPlus.history.loadMore')}
        </button>
      )}
    </div>
  );
}

export default PointsHistory;
