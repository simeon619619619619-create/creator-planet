// =============================================================================
// RedemptionCard Component
// Shows a user's reward redemption with status and details
// =============================================================================

import { useTranslation } from 'react-i18next';
import type { RewardRedemption, RedemptionStatus, RewardType } from '../studentPlusTypes';

interface RedemptionCardProps {
  redemption: RewardRedemption;
}

const statusColors: Record<RedemptionStatus, string> = {
  pending: 'bg-[#EAB308]/10 text-[#EAB308]',
  active: 'bg-[#22C55E]/10 text-[#22C55E]',
  used: 'bg-[#1F1F1F] text-[#A0A0A0]',
  expired: 'bg-[#EF4444]/10 text-[#EF4444]',
  revoked: 'bg-[#EF4444]/10 text-[#EF4444]',
};

const rewardTypeIcons: Record<RewardType, string> = {
  voucher: '🎟️',
  template_pack: '📦',
  fee_discount: '💸',
  priority_support: '🚀',
  exclusive_content: '🔒',
  badge: '🏅',
};

export function RedemptionCard({ redemption }: RedemptionCardProps) {
  const { t } = useTranslation();

  const statusLabels: Record<RedemptionStatus, string> = {
    pending: t('studentPlus.redemption.status.pending'),
    active: t('studentPlus.redemption.status.active'),
    used: t('studentPlus.redemption.status.used'),
    expired: t('studentPlus.redemption.status.expired'),
    revoked: t('studentPlus.redemption.status.revoked'),
  };
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t('studentPlus.redemption.na');
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isExpiringSoon = () => {
    if (!redemption.valid_until || redemption.status !== 'active') return false;
    const daysUntilExpiry = Math.ceil(
      (new Date(redemption.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  const getDaysRemaining = () => {
    if (!redemption.valid_until) return null;
    const days = Math.ceil(
      (new Date(redemption.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return days > 0 ? days : 0;
  };

  const rewardName = redemption.reward?.name || 'Reward';
  const daysRemaining = getDaysRemaining();

  return (
    <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="text-3xl">{rewardTypeIcons[redemption.reward_type]}</div>
          <div>
            <h3 className="font-semibold text-[#FAFAFA]">{rewardName}</h3>
            <p className="text-sm text-[#666666] mt-1">
              {t('studentPlus.redemption.redeemedOn')} {formatDate(redemption.created_at)}
            </p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[redemption.status]}`}>
          {statusLabels[redemption.status]}
        </span>
      </div>

      {/* Voucher Code Display */}
      {redemption.voucher_code && redemption.status === 'active' && (
        <div className="mt-4 p-4 bg-[#151515] border border-[#1F1F1F] rounded-lg">
          <div className="text-xs text-[#FAFAFA] font-medium mb-1">{t('studentPlus.redemption.yourVoucherCode')}</div>
          <div className="flex items-center gap-2">
            <code className="text-lg font-mono font-bold text-[#FAFAFA]">
              {redemption.voucher_code}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(redemption.voucher_code!)}
              className="text-[#FAFAFA] hover:text-[#A0A0A0] text-sm"
            >
              {t('studentPlus.redemption.copy')}
            </button>
          </div>
        </div>
      )}

      {/* Validity Info */}
      {redemption.valid_until && redemption.status === 'active' && (
        <div className={`mt-4 p-3 rounded-lg ${isExpiringSoon() ? 'bg-[#EAB308]/10 border border-[#EAB308]/20' : 'bg-[#0A0A0A]'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm ${isExpiringSoon() ? 'text-yellow-700' : 'text-[#A0A0A0]'}`}>
              {isExpiringSoon() ? t('studentPlus.redemption.expiresSoon') : t('studentPlus.redemption.validUntil')}
            </span>
            <span className={`font-medium ${isExpiringSoon() ? 'text-[#EAB308]' : 'text-[#FAFAFA]'}`}>
              {formatDate(redemption.valid_until)}
              {daysRemaining !== null && daysRemaining > 0 && (
                <span className="text-sm font-normal text-[#666666] ml-1">
                  ({daysRemaining === 1 ? t('studentPlus.redemption.daysLeft', { count: daysRemaining }) : t('studentPlus.redemption.daysLeftPlural', { count: daysRemaining })})
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Used Info */}
      {redemption.status === 'used' && redemption.used_at && (
        <div className="mt-4 p-3 bg-[#0A0A0A] rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#A0A0A0]">{t('studentPlus.redemption.usedOn')}</span>
            <span className="font-medium text-[#FAFAFA]">{formatDate(redemption.used_at)}</span>
          </div>
          {redemption.used_for_reference && (
            <div className="text-xs text-[#666666] mt-1">
              {t('studentPlus.redemption.reference')} {redemption.used_for_reference}
            </div>
          )}
        </div>
      )}

      {/* Points Spent */}
      {redemption.points_spent > 0 && (
        <div className="mt-4 text-sm text-[#666666]">
          {t('studentPlus.redemption.pointsSpent')} {redemption.points_spent.toLocaleString()}
        </div>
      )}
    </div>
  );
}

export default RedemptionCard;
