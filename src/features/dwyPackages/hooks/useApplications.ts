// =============================================================================
// useApplications Hook
// Manages DWY package applications
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { dwyService } from '../dwyService';
import type { DwyApplication, DwyApplicationFormData } from '../dwyTypes';

interface UseApplicationsReturn {
  applications: DwyApplication[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  submitApplication: (packageId: string, formData: DwyApplicationFormData) => Promise<DwyApplication>;
  withdrawApplication: (id: string) => Promise<void>;
  hasPendingForPackage: (packageId: string) => boolean;
}

export function useApplications(): UseApplicationsReturn {
  const [applications, setApplications] = useState<DwyApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dwyService.getMyApplications();
      setApplications(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch applications'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const submitApplication = useCallback(async (
    packageId: string,
    formData: DwyApplicationFormData
  ): Promise<DwyApplication> => {
    const application = await dwyService.submitApplication(packageId, formData);
    await fetchData();
    return application;
  }, [fetchData]);

  const withdrawApplication = useCallback(async (id: string): Promise<void> => {
    await dwyService.withdrawApplication(id);
    await fetchData();
  }, [fetchData]);

  const hasPendingForPackage = useCallback((packageId: string): boolean => {
    return applications.some(
      app => app.package_id === packageId &&
      ['pending', 'under_review', 'interview_scheduled', 'approved'].includes(app.status)
    );
  }, [applications]);

  return {
    applications,
    isLoading,
    error,
    refetch: fetchData,
    submitApplication,
    withdrawApplication,
    hasPendingForPackage,
  };
}

export default useApplications;
