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
    active: 'bg-[#22C55E]/10 text-[#22C55E]',
    trialing: 'bg-[#1F1F1F] text-[#A0A0A0]',
    past_due: 'bg-[#EAB308]/10 text-[#EAB308]',
    canceled: 'bg-[#1F1F1F] text-[#666666]',
    incomplete: 'bg-[#EAB308]/10 text-[#EAB308]',
    incomplete_expired: 'bg-[#EF4444]/10 text-[#EF4444]',
    paused: 'bg-[#1F1F1F] text-[#A0A0A0]',
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
    <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl font-bold text-[#FAFAFA]">{t('studentPlus.subscription.title')}</h2>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[subscription.status]}`}>
              {statusLabel[subscription.status]}
            </span>
          </div>
          <p className="text-[#A0A0A0] text-sm">
            {formatPrice(STUDENT_PLUS_CONFIG.product.amount)}{t('studentPlus.subscription.perMonth')}
          </p>
        </div>
        <button
          onClick={handleManageSubscription}
          disabled={isManaging}
          className="text-sm text-[#FAFAFA] hover:text-[#A0A0A0] font-medium disabled:opacity-50"
        >
          {isManaging ? t('studentPlus.subscription.loading') : t('studentPlus.subscription.manageSubscription')}
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-[#1F1F1F]">
        <div>
          <div className="text-2xl font-bold text-[#FAFAFA]">
            {subscription.consecutive_months}
          </div>
          <div className="text-xs text-[#666666]">{t('studentPlus.subscription.stats.monthsActive')}</div>
        </div>
        <div>
          <div className="text-sm font-medium text-[#FAFAFA]">
            {formatDate(subscription.subscribed_since)}
          </div>
          <div className="text-xs text-[#666666]">{t('studentPlus.subscription.stats.memberSince')}</div>
        </div>
        <div>
          <div className="text-sm font-medium text-[#FAFAFA]">
            {formatDate(subscription.current_period_end)}
          </div>
          <div className="text-xs text-[#666666]">{t('studentPlus.subscription.stats.nextBilling')}</div>
        </div>
      </div>

      {/* Cancellation Warning */}
      {subscription.cancel_at_period_end && (
        <div className="mt-4 p-3 bg-[#EAB308]/10 border border-[#EAB308]/20 rounded-lg">
          <p className="text-sm text-[#EAB308]">
            <span className="font-medium">{t('studentPlus.subscription.cancellationScheduled')}</span> {t('studentPlus.subscription.cancellationMessage', { date: formatDate(subscription.current_period_end) })}
          </p>
        </div>
      )}
    </div>
  );
}

export default SubscriptionStatus;
