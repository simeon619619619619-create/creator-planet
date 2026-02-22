// ============================================================================
// USE LIMIT CHECK HOOKS
// Specialized hooks for checking specific limits before actions
// ============================================================================

import { useMemo, useCallback } from 'react';
import { usePlanLimits } from './usePlanLimits';
import type { UpgradeReason } from '../stripeTypes';

// ============================================================================
// TYPES
// ============================================================================

export interface LimitCheckResult {
  /** Whether the action is allowed */
  allowed: boolean;
  /** The reason why it's not allowed (if not allowed) */
  reason?: UpgradeReason;
  /** Show the upgrade prompt */
  showPrompt: () => void;
  /** Current usage count */
  current: number;
  /** Maximum allowed */
  max: number;
  /** Whether limit is unlimited */
  unlimited: boolean;
  /** Whether the check is still loading */
  loading: boolean;
}

// ============================================================================
// STUDENT LIMIT CHECK
// ============================================================================

/**
 * Hook to check if a creator can add more students
 */
export function useStudentLimitCheck(): LimitCheckResult {
  const { canAddStudent, usage, showUpgradePrompt, loading } = usePlanLimits();

  const showPrompt = useCallback(() => {
    showUpgradePrompt('student_limit');
  }, [showUpgradePrompt]);

  return useMemo(() => ({
    allowed: canAddStudent,
    reason: canAddStudent ? undefined : 'student_limit',
    showPrompt,
    current: usage.students.current,
    max: usage.students.max,
    unlimited: usage.students.unlimited,
    loading,
  }), [canAddStudent, usage.students, showPrompt, loading]);
}

// ============================================================================
// COURSE LIMIT CHECK
// ============================================================================

/**
 * Hook to check if a creator can add more courses
 */
export function useCourseLimitCheck(): LimitCheckResult {
  const { canAddCourse, usage, showUpgradePrompt, loading } = usePlanLimits();

  const showPrompt = useCallback(() => {
    showUpgradePrompt('course_limit');
  }, [showUpgradePrompt]);

  return useMemo(() => ({
    allowed: canAddCourse,
    reason: canAddCourse ? undefined : 'course_limit',
    showPrompt,
    current: usage.courses.current,
    max: usage.courses.max,
    unlimited: usage.courses.unlimited,
    loading,
  }), [canAddCourse, usage.courses, showPrompt, loading]);
}

// ============================================================================
// COMMUNITY LIMIT CHECK
// ============================================================================

/**
 * Hook to check if a creator can add more communities
 */
export function useCommunityLimitCheck(): LimitCheckResult {
  const { canAddCommunity, usage, showUpgradePrompt, loading } = usePlanLimits();

  const showPrompt = useCallback(() => {
    showUpgradePrompt('community_limit');
  }, [showUpgradePrompt]);

  return useMemo(() => ({
    allowed: canAddCommunity,
    reason: canAddCommunity ? undefined : 'community_limit',
    showPrompt,
    current: usage.communities.current,
    max: usage.communities.max,
    unlimited: usage.communities.unlimited,
    loading,
  }), [canAddCommunity, usage.communities, showPrompt, loading]);
}

// ============================================================================
// GENERIC FEATURE CHECK
// ============================================================================

/**
 * Hook to check if a creator has access to a specific feature
 */
export function useFeatureCheck(
  feature: 'custom_branding' | 'white_label' | 'advanced_analytics' | 'api_access' | 'priority_support'
): {
  allowed: boolean;
  reason?: UpgradeReason;
  showPrompt: () => void;
  loading: boolean;
} {
  const {
    hasCustomBranding,
    hasWhiteLabel,
    hasAdvancedAnalytics,
    hasApiAccess,
    hasPrioritySupport,
    showUpgradePrompt,
    loading,
  } = usePlanLimits();

  const featureMap: Record<string, { hasAccess: boolean; reason: UpgradeReason }> = {
    custom_branding: { hasAccess: hasCustomBranding, reason: 'custom_branding' },
    white_label: { hasAccess: hasWhiteLabel, reason: 'white_label' },
    advanced_analytics: { hasAccess: hasAdvancedAnalytics, reason: 'advanced_analytics' },
    api_access: { hasAccess: hasApiAccess, reason: 'api_access' },
    priority_support: { hasAccess: hasPrioritySupport, reason: 'priority_support' },
  };

  const { hasAccess, reason } = featureMap[feature] || { hasAccess: false, reason: feature as UpgradeReason };

  const showPrompt = useCallback(() => {
    showUpgradePrompt(reason);
  }, [showUpgradePrompt, reason]);

  return useMemo(() => ({
    allowed: hasAccess,
    reason: hasAccess ? undefined : reason,
    showPrompt,
    loading,
  }), [hasAccess, reason, showPrompt, loading]);
}
