// =============================================================================
// useLoyaltyPoints Hook
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { studentPlusService } from '../studentPlusService';
import type { LoyaltyPointsBalance, LoyaltyPointTransaction } from '../studentPlusTypes';

interface UseLoyaltyPointsReturn {
  balance: LoyaltyPointsBalance;
  history: LoyaltyPointTransaction[];
  isLoading: boolean;
  isLoadingHistory: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  fetchMoreHistory: (limit?: number) => Promise<void>;
}

const DEFAULT_BALANCE: LoyaltyPointsBalance = {
  user_id: '',
  total_points: 0,
  total_spent: 0,
  total_earned: 0,
};

export function useLoyaltyPoints(): UseLoyaltyPointsReturn {
  const [balance, setBalance] = useState<LoyaltyPointsBalance>(DEFAULT_BALANCE);
  const [history, setHistory] = useState<LoyaltyPointTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchBalance = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await studentPlusService.getPointsBalance();
      setBalance(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch points balance'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (limit = 20, offset = 0, append = false) => {
    setIsLoadingHistory(true);
    try {
      const data = await studentPlusService.getPointsHistory(limit, offset);
      setHistory(prev => append ? [...prev, ...data] : data);
    } catch (err) {
      console.error('Failed to fetch points history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
    fetchHistory();
  }, [fetchBalance, fetchHistory]);

  const refetch = useCallback(async () => {
    await Promise.all([fetchBalance(), fetchHistory()]);
  }, [fetchBalance, fetchHistory]);

  const fetchMoreHistory = useCallback(async (limit = 20) => {
    await fetchHistory(limit, history.length, true);
  }, [fetchHistory, history.length]);

  return {
    balance,
    history,
    isLoading,
    isLoadingHistory,
    error,
    refetch,
    fetchMoreHistory,
  };
}

export default useLoyaltyPoints;
