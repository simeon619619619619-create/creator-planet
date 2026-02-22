// =============================================================================
// useRewards Hook
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { studentPlusService } from '../studentPlusService';
import type { Reward, RewardRedemption } from '../studentPlusTypes';

interface UseRewardsReturn {
  rewards: Reward[];
  myRedemptions: RewardRedemption[];
  activeRedemptions: RewardRedemption[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  redeemReward: (rewardId: string) => Promise<RewardRedemption>;
}

export function useRewards(): UseRewardsReturn {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [myRedemptions, setMyRedemptions] = useState<RewardRedemption[]>([]);
  const [activeRedemptions, setActiveRedemptions] = useState<RewardRedemption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rewardsData, redemptionsData, activeData] = await Promise.all([
        studentPlusService.getAvailableRewards(),
        studentPlusService.getMyRedemptions(),
        studentPlusService.getActiveRedemptions(),
      ]);
      setRewards(rewardsData);
      setMyRedemptions(redemptionsData);
      setActiveRedemptions(activeData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch rewards'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const redeemReward = useCallback(async (rewardId: string): Promise<RewardRedemption> => {
    const redemption = await studentPlusService.redeemReward(rewardId);
    // Refresh data after redemption
    await fetchData();
    return redemption;
  }, [fetchData]);

  return {
    rewards,
    myRedemptions,
    activeRedemptions,
    isLoading,
    error,
    refetch: fetchData,
    redeemReward,
  };
}

export default useRewards;
