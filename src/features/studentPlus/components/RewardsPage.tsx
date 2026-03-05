// =============================================================================
// RewardsPage Component
// Browse and redeem rewards using loyalty points
// =============================================================================

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRewards } from '../hooks/useRewards';
import { useLoyaltyPoints } from '../hooks/useLoyaltyPoints';
import { RewardCard } from './RewardCard';
import { RedemptionCard } from './RedemptionCard';

export function RewardsPage() {
  const { t } = useTranslation();
  const { rewards, myRedemptions, isLoading, error, redeemReward } = useRewards();
  const { balance, refetch: refetchPoints } = useLoyaltyPoints();
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'available' | 'my-rewards'>('available');

  const handleRedeem = async (rewardId: string) => {
    setRedeeming(rewardId);
    setRedeemError(null);
    try {
      await redeemReward(rewardId);
      await refetchPoints();
      setActiveTab('my-rewards');
    } catch (err) {
      console.error('Redemption error:', err);
      setRedeemError(
        err instanceof Error ? err.message : t('studentPlus.rewards.redeemError')
      );
    } finally {
      setRedeeming(null);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-[#1F1F1F] rounded" />
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 bg-[#1F1F1F] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl p-4 text-[#EF4444]">
          {t('studentPlus.rewards.loadError')}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-[#FAFAFA]">{t('studentPlus.rewards.title')}</h1>
        <div className="bg-[#1F1F1F] text-[#A0A0A0] px-4 py-2 rounded-lg font-semibold">
          {balance.total_points.toLocaleString()} {t('studentPlus.rewards.pointsAvailable')}
        </div>
      </div>

      {/* Error Banner */}
      {redeemError && (
        <div className="mb-6 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg p-4 text-[#EF4444]">
          {redeemError}
          <button
            onClick={() => setRedeemError(null)}
            className="ml-2 text-[#EF4444] hover:text-[#EF4444]"
          >
            {t('studentPlus.rewards.dismiss')}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-[#1F1F1F]">
        <button
          onClick={() => setActiveTab('available')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'available'
              ? 'border-b-2 border-[#1F1F1F] text-[#FAFAFA]'
              : 'text-[#666666] hover:text-[#A0A0A0]'
          }`}
        >
          {t('studentPlus.rewards.tabs.availableRewards')}
        </button>
        <button
          onClick={() => setActiveTab('my-rewards')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'my-rewards'
              ? 'border-b-2 border-[#1F1F1F] text-[#FAFAFA]'
              : 'text-[#666666] hover:text-[#A0A0A0]'
          }`}
        >
          {t('studentPlus.rewards.tabs.myRewards')} ({myRedemptions.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'available' ? (
        <div className="grid md:grid-cols-2 gap-4">
          {rewards.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-[#666666]">
              {t('studentPlus.rewards.noRewardsAvailable')}
            </div>
          ) : (
            rewards.map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                userPoints={balance.total_points}
                onRedeem={() => handleRedeem(reward.id)}
                isRedeeming={redeeming === reward.id}
              />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {myRedemptions.length === 0 ? (
            <div className="text-center py-12 text-[#666666]">
              {t('studentPlus.rewards.noRedeemedRewards')}
              <button
                onClick={() => setActiveTab('available')}
                className="block mx-auto mt-2 text-[#FAFAFA] hover:text-[#A0A0A0] font-medium"
              >
                {t('studentPlus.rewards.browseAvailableRewards')}
              </button>
            </div>
          ) : (
            myRedemptions.map((redemption) => (
              <RedemptionCard key={redemption.id} redemption={redemption} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default RewardsPage;
