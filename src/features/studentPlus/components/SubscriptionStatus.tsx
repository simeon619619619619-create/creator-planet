// =============================================================================
// SubscriptionStatus Component
// Shows current subscription info and management options
// =============================================================================

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StudentSubscription } from '../studentPlusTypes';
import { studentPlusService } from '../studentPlusService';
import { formatPrice, STUDENT_PLUS_CONFIG } from '../studentPlusTypes';

interface SubscriptionStatusProps {
  subscription: StudentSubscription;
  onUpdate: () => Promise<void>;
}

export function SubscriptionStatus({ subscription, onUpdate }: SubscriptionStatusProps) {
  const { t } = useTranslation();
  const [isManaging, setIsManaging] = useState(false);

  const handleManageSubscription = async () => {
    setIsManaging(true);
    try {
      const { portalUrl } = await studentPlusService.createPortalSession(
        window.location.href
      );
      window.location.href = portalUrl;
    } catch (error) {
      console.error('Portal error:', error);
      setIsManaging(false);
    }
  };

  const statusColor = {
    active: 'bg-green-100 text-green-800',
    trialing: 'bg-blue-100 text-blue-800',
    past_due: 'bg-yellow-100 text-yellow-800',
    canceled: 'bg-gray-100 text-gray-800',
    incomplete: 'bg-orange-100 text-orange-800',
    incomplete_expired: 'bg-red-100 text-red-800',
    paused: 'bg-gray-100 text-gray-600',
  };

  const statusLabel = {
    active: t('studentPlus.subscription.status.active'),
    trialing: t('studentPlus.subscription.status.trialing'),
    past_due: t('studentPlus.subscription.status.pastDue'),
    canceled: t('studentPlus.subscription.status.canceled'),
    incomplete: t('studentPlus.subscription.status.incomplete'),
    incomplete_expired: t('studentPlus.subscription.status.incompleteExpired'),
    paused: t('studentPlus.subscription.status.paused'),
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t('studentPlus.subscription.na');
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl font-bold text-gray-900">{t('studentPlus.subscription.title')}</h2>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[subscription.status]}`}>
              {statusLabel[subscription.status]}
            </span>
          </div>
          <p className="text-gray-600 text-sm">
            {formatPrice(STUDENT_PLUS_CONFIG.product.amount)}{t('studentPlus.subscription.perMonth')}
          </p>
        </div>
        <button
          onClick={handleManageSubscription}
          disabled={isManaging}
          className="text-sm text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
        >
          {isManaging ? t('studentPlus.subscription.loading') : t('studentPlus.subscription.manageSubscription')}
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
        <div>
          <div className="text-2xl font-bold text-gray-900">
            {subscription.consecutive_months}
          </div>
          <div className="text-xs text-gray-500">{t('studentPlus.subscription.stats.monthsActive')}</div>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-900">
            {formatDate(subscription.subscribed_since)}
          </div>
          <div className="text-xs text-gray-500">{t('studentPlus.subscription.stats.memberSince')}</div>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-900">
            {formatDate(subscription.current_period_end)}
          </div>
          <div className="text-xs text-gray-500">{t('studentPlus.subscription.stats.nextBilling')}</div>
        </div>
      </div>

      {/* Cancellation Warning */}
      {subscription.cancel_at_period_end && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <span className="font-medium">{t('studentPlus.subscription.cancellationScheduled')}</span> {t('studentPlus.subscription.cancellationMessage', { date: formatDate(subscription.current_period_end) })}
          </p>
        </div>
      )}
    </div>
  );
}

export default SubscriptionStatus;
