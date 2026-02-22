// ============================================================================
// USE PLAN LIMITS HOOK
// React hook for plan-based feature gating
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../core/contexts/AuthContext';
import { supabase } from '../../../core/supabase/client';
import {
  PlanTier,
  PlanFeatures,
  UpgradeReason,
  PLAN_LIMITS,
  UPGRADE_MESSAGES,
} from '../stripeTypes';

// ============================================================================
// TYPES
// ============================================================================

interface UsageInfo {
  current: number;
  max: number;
  unlimited: boolean;
}

interface PlanUsage {
  students: UsageInfo;
  courses: UsageInfo;
  communities: UsageInfo;
}

export interface PlanLimitsHook {
  // Check capabilities
  canAddStudent: boolean;
  canAddCourse: boolean;
  canAddCommunity: boolean;
  hasAiAccess: boolean;
  hasCustomBranding: boolean;
  hasPrioritySupport: boolean;
  hasWhiteLabel: boolean;
  hasAdvancedAnalytics: boolean;
  hasApiAccess: boolean;

  // Current usage vs limits
  usage: PlanUsage;

  // Utilities
  checkFeature: (feature: keyof PlanFeatures) => boolean;
  showUpgradePrompt: (reason: UpgradeReason) => void;

  // State
  loading: boolean;
  currentTier: PlanTier;

  // Upgrade prompt state
  upgradePromptReason: UpgradeReason | null;
  closeUpgradePrompt: () => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function usePlanLimits(): PlanLimitsHook {
  const { user, role, profile } = useAuth();

  // State
  const [loading, setLoading] = useState(true);
  const [currentTier, setCurrentTier] = useState<PlanTier>('starter');
  const [studentCount, setStudentCount] = useState(0);
  const [courseCount, setCourseCount] = useState(0);
  const [communityCount, setCommunityCount] = useState(0);
  const [upgradePromptReason, setUpgradePromptReason] = useState<UpgradeReason | null>(null);

  // Get plan limits for current tier
  const limits = useMemo(() => PLAN_LIMITS[currentTier], [currentTier]);

  // Fetch creator's plan tier and usage counts
  useEffect(() => {
    const fetchPlanAndUsage = async () => {
      // Only apply limits to creators
      if (!profile || role !== 'creator') {
        setLoading(false);
        return;
      }

      try {
        // Fetch plan tier using RPC function
        // Use profile.id because creator_id columns reference profiles.id
        const { data: tierData, error: tierError } = await supabase
          .rpc('get_creator_plan_tier', { p_creator_id: profile.id });

        if (tierError) {
          console.error('Error fetching plan tier:', tierError);
          // Fallback to starter if error
          setCurrentTier('starter');
        } else if (tierData) {
          setCurrentTier(tierData as PlanTier);
        }

        // Fetch student count (unique members across all communities)
        // First get all community IDs for the creator
        const { data: communities } = await supabase
          .from('communities')
          .select('id')
          .eq('creator_id', profile.id);

        if (communities && communities.length > 0) {
          const communityIds = communities.map(c => c.id);

          // Count unique students
          const { data: memberships } = await supabase
            .from('memberships')
            .select('user_id')
            .in('community_id', communityIds)
            .eq('role', 'member');

          // Count unique user_ids
          const uniqueStudents = new Set(memberships?.map(m => m.user_id) || []);
          setStudentCount(uniqueStudents.size);
        } else {
          setStudentCount(0);
        }

        // Fetch course count
        const { count: coursesResult } = await supabase
          .from('courses')
          .select('id', { count: 'exact', head: true })
          .eq('creator_id', profile.id);

        setCourseCount(coursesResult || 0);

        // Fetch community count
        const { count: communitiesResult } = await supabase
          .from('communities')
          .select('id', { count: 'exact', head: true })
          .eq('creator_id', profile.id);

        setCommunityCount(communitiesResult || 0);
      } catch (error) {
        console.error('Error fetching plan limits:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlanAndUsage();
  }, [profile, role]);

  // Calculate usage info
  const usage: PlanUsage = useMemo(() => ({
    students: {
      current: studentCount,
      max: limits.max_students,
      unlimited: limits.max_students === -1,
    },
    courses: {
      current: courseCount,
      max: limits.max_courses,
      unlimited: limits.max_courses === -1,
    },
    communities: {
      current: communityCount,
      max: limits.max_communities,
      unlimited: limits.max_communities === -1,
    },
  }), [studentCount, courseCount, communityCount, limits]);

  // Check if can add more resources
  const canAddStudent = useMemo(() => {
    if (role !== 'creator') return true; // Non-creators bypass limits
    if (limits.max_students === -1) return true;
    return studentCount < limits.max_students;
  }, [role, studentCount, limits.max_students]);

  const canAddCourse = useMemo(() => {
    if (role !== 'creator') return true;
    if (limits.max_courses === -1) return true;
    return courseCount < limits.max_courses;
  }, [role, courseCount, limits.max_courses]);

  const canAddCommunity = useMemo(() => {
    if (role !== 'creator') return true;
    if (limits.max_communities === -1) return true;
    return communityCount < limits.max_communities;
  }, [role, communityCount, limits.max_communities]);

  // Feature access checks
  const hasAiAccess = limits.ai_enabled;
  const hasCustomBranding = limits.custom_branding;
  const hasPrioritySupport = limits.priority_support;
  const hasWhiteLabel = limits.white_label;
  const hasAdvancedAnalytics = limits.advanced_analytics;
  const hasApiAccess = limits.api_access;

  // Generic feature check
  const checkFeature = useCallback((feature: keyof PlanFeatures): boolean => {
    const value = limits[feature];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return false;
  }, [limits]);

  // Show upgrade prompt
  const showUpgradePrompt = useCallback((reason: UpgradeReason) => {
    setUpgradePromptReason(reason);
  }, []);

  // Close upgrade prompt
  const closeUpgradePrompt = useCallback(() => {
    setUpgradePromptReason(null);
  }, []);

  return {
    // Capabilities
    canAddStudent,
    canAddCourse,
    canAddCommunity,
    hasAiAccess,
    hasCustomBranding,
    hasPrioritySupport,
    hasWhiteLabel,
    hasAdvancedAnalytics,
    hasApiAccess,

    // Usage
    usage,

    // Utilities
    checkFeature,
    showUpgradePrompt,

    // State
    loading,
    currentTier,

    // Upgrade prompt
    upgradePromptReason,
    closeUpgradePrompt,
  };
}

// ============================================================================
// HELPER: Get upgrade message for a reason
// ============================================================================

export function getUpgradeMessage(reason: UpgradeReason): { title: string; description: string } {
  return UPGRADE_MESSAGES[reason] || {
    title: 'Upgrade Required',
    description: 'This feature is available on a higher plan.',
  };
}

// ============================================================================
// HELPER: Get recommended plan for upgrade
// ============================================================================

export function getRecommendedPlanForUpgrade(
  reason: UpgradeReason,
  currentTier: PlanTier
): PlanTier {
  // Features only available on Scale
  const scaleOnlyFeatures: UpgradeReason[] = ['white_label', 'api_access'];

  if (scaleOnlyFeatures.includes(reason)) {
    return 'scale';
  }

  // For limits and pro features, recommend Pro if on Starter, Scale if on Pro
  if (currentTier === 'starter') {
    return 'pro';
  }

  return 'scale';
}
