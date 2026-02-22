// =============================================================================
// useEngagements Hook
// Manages active DWY service engagements
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { dwyService } from '../dwyService';
import type { DwyEngagement } from '../dwyTypes';

interface UseEngagementsReturn {
  engagements: DwyEngagement[];
  activeEngagements: DwyEngagement[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useEngagements(): UseEngagementsReturn {
  const [engagements, setEngagements] = useState<DwyEngagement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dwyService.getMyEngagements();
      setEngagements(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch engagements'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeEngagements = engagements.filter(
    eng => ['onboarding', 'active'].includes(eng.status)
  );

  return {
    engagements,
    activeEngagements,
    isLoading,
    error,
    refetch: fetchData,
  };
}

export default useEngagements;
