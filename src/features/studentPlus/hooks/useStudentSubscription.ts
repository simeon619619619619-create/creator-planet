// =============================================================================
// useStudentSubscription Hook
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { studentPlusService } from '../studentPlusService';
import type { StudentSubscription } from '../studentPlusTypes';

interface UseStudentSubscriptionReturn {
  subscription: StudentSubscription | null;
  isLoading: boolean;
  error: Error | null;
  isSubscribed: boolean;
  isActive: boolean;
  isCanceled: boolean;
  consecutiveMonths: number;
  refetch: () => Promise<void>;
}

export function useStudentSubscription(): UseStudentSubscriptionReturn {
  const [subscription, setSubscription] = useState<StudentSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSubscription = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await studentPlusService.getSubscription();
      setSubscription(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch subscription'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';
  const isCanceled = subscription?.status === 'canceled' || subscription?.cancel_at_period_end === true;

  return {
    subscription,
    isLoading,
    error,
    isSubscribed: isActive,
    isActive,
    isCanceled,
    consecutiveMonths: subscription?.consecutive_months ?? 0,
    refetch: fetchSubscription,
  };
}

export default useStudentSubscription;
