// =============================================================================
// usePackages Hook
// Fetches and manages DWY packages data
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { dwyService } from '../dwyService';
import type { DwyPackage } from '../dwyTypes';

interface UsePackagesReturn {
  packages: DwyPackage[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function usePackages(): UsePackagesReturn {
  const [packages, setPackages] = useState<DwyPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dwyService.getPackages();
      setPackages(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch packages'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    packages,
    isLoading,
    error,
    refetch: fetchData,
  };
}

export default usePackages;
