// =============================================================================
// useMilestones Hook
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { studentPlusService } from '../studentPlusService';
import type { LoyaltyMilestone, MilestoneAchievement, MilestoneWithProgress } from '../studentPlusTypes';

interface UseMilestonesReturn {
  milestones: LoyaltyMilestone[];
  achievements: MilestoneAchievement[];
  milestonesWithProgress: MilestoneWithProgress[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  getNextMilestone: () => MilestoneWithProgress | null;
}

export function useMilestones(consecutiveMonths: number): UseMilestonesReturn {
  const [milestones, setMilestones] = useState<LoyaltyMilestone[]>([]);
  const [achievements, setAchievements] = useState<MilestoneAchievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [milestonesData, achievementsData] = await Promise.all([
        studentPlusService.getMilestones(),
        studentPlusService.getMyAchievements(),
      ]);
      setMilestones(milestonesData);
      setAchievements(achievementsData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch milestones'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Combine milestones with achievement status and progress
  const milestonesWithProgress = useMemo((): MilestoneWithProgress[] => {
    return milestones.map(milestone => {
      const achievement = achievements.find(a => a.milestone_id === milestone.id);
      const achieved = !!achievement;

      // Calculate progress percentage toward this milestone
      let progress = 0;
      if (achieved) {
        progress = 100;
      } else if (consecutiveMonths >= milestone.months_required) {
        progress = 100;
      } else {
        progress = Math.min(100, (consecutiveMonths / milestone.months_required) * 100);
      }

      return {
        ...milestone,
        achieved,
        achievement,
        progress,
      };
    });
  }, [milestones, achievements, consecutiveMonths]);

  // Get the next milestone to achieve
  const getNextMilestone = useCallback((): MilestoneWithProgress | null => {
    const next = milestonesWithProgress.find(m => !m.achieved);
    return next || null;
  }, [milestonesWithProgress]);

  return {
    milestones,
    achievements,
    milestonesWithProgress,
    isLoading,
    error,
    refetch: fetchData,
    getNextMilestone,
  };
}

export default useMilestones;
