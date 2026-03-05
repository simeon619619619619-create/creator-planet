// =============================================================================
// RewardCard Component
// Individual reward display with redeem functionality
// =============================================================================

import { useTranslation } from 'react-i18next';
import type { Reward, RewardType } from '../studentPlusTypes';

interface RewardCardProps {
  reward: Reward;
  userPoints: number;
  onRedeem: () => void;
  isRedeeming: boolean;
}

const rewardTypeIcons: Record<RewardType, string> = {
  voucher: '🎟️',
  template_pack: '📦',
  fee_discount: '💸',
  priority_support: '🚀',
  exclusive_content: '🔒',
  badge: '🏅',
};

export function RewardCard({ reward, userPoints, onRedeem, isRedeeming }: RewardCardProps) {
  const { t } = useTranslation();
  const canAfford = userPoints >= reward.point_cost;
  const isAvailable = !reward.max_redemptions || reward.current_redemptions < reward.max_redemptions;

  const getRewardDetails = (): string => {
    const config = reward.value_config as Record<string, unknown>;
    switch (reward.reward_type) {
      case 'voucher':
        return t('studentPlus.rewardCard.rewardDetails.voucherTemplate', { percent: config.discount_percent, days: config.valid_days });
      case 'priority_support':
        return t('studentPlus.rewardCard.rewardDetails.prioritySupportTemplate', { days: config.duration_days });
      case 'fee_discount':
        return t('studentPlus.rewardCard.rewardDetails.feeDiscountTemplate', { percent: config.discount_percent, days: config.duration_days });
      case 'template_pack':
        return t('studentPlus.rewardCard.rewardDetails.templatePackDescription');
      default:
        return '';
    }
  };

  return (
    <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <div className="text-3xl">{rewardTypeIcons[reward.reward_type]}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[#FAFAFA] truncate">{reward.name}</h3>
          <p className="text-sm text-[#666666] mt-1">{reward.description}</p>
          <div className="text-xs text-[#666666] mt-2">{getRewardDetails()}</div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#1F1F1F]">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-[#FAFAFA]">
            {reward.point_cost.toLocaleString()}
          </span>
          <span className="text-sm text-[#666666]">{t('studentPlus.rewardCard.points')}</span>
        </div>

        <button
          onClick={onRedeem}
          disabled={!canAfford || !isAvailable || isRedeeming}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            canAfford && isAvailable
              ? 'bg-white text-black hover:bg-[#E0E0E0]'
              : 'bg-[#1F1F1F] text-[#666666] cursor-not-allowed'
          }`}
        >
          {isRedeeming ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
              {t('studentPlus.rewardCard.redeeming')}
            </span>
          ) : !isAvailable ? (
            t('studentPlus.rewardCard.soldOut')
          ) : !canAfford ? (
            t('studentPlus.rewardCard.notEnoughPoints')
          ) : (
            t('studentPlus.rewardCard.redeem')
          )}
        </button>
      </div>

      {/* Progress indicator if close to affording */}
      {!canAfford && userPoints > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-[#666666] mb-1">
            <span>{userPoints} / {reward.point_cost}</span>
            <span>{Math.round((userPoints / reward.point_cost) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-[#1F1F1F] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1F1F1F] rounded-full"
              style={{ width: `${Math.min(100, (userPoints / reward.point_cost) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default RewardCard;
