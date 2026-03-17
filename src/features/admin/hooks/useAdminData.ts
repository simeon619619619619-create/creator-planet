import { useQuery } from '@tanstack/react-query';
import {
  getAdminOverviewStats,
  getCreatorLeaderboard,
  getRevenueTimeSeries,
  getEnrollmentTrends,
  getCommunityHealth,
} from '../adminService';
import type {
  TimeRange,
  AdminOverviewStats,
  CreatorRow,
  RevenueDataPoint,
  EnrollmentTrendPoint,
  CommunityRow,
} from '../types';

const STALE_TIME = 2 * 60 * 1000; // 2 minutes

const defaultOverviewStats: AdminOverviewStats = {
  totalCreators: 0,
  creatorsByPlan: { starter: 0, pro: 0, scale: 0 },
  activeCreators: 0,
  inactiveCreators: 0,
  totalStudents: 0,
  totalEnrollments: 0,
  activeEnrollments: 0,
  avgCompletionRate: 0,
  atRiskStudentCount: 0,
  totalPlatformRevenue: 0,
  totalGrossRevenue: 0,
  monthlyRecurringRevenue: 0,
  transactionCount: 0,
  totalCommunities: 0,
  publicCommunities: 0,
  privateCommunities: 0,
  avgMembersPerCommunity: 0,
  totalPosts: 0,
};

export function useAdminOverview(timeRange: TimeRange) {
  return useQuery<AdminOverviewStats>({
    queryKey: ['admin', 'overview', timeRange],
    queryFn: () => getAdminOverviewStats(timeRange),
    staleTime: STALE_TIME,
    placeholderData: defaultOverviewStats,
  });
}

export function useCreatorLeaderboard(sortBy: string = 'revenue', limit: number = 20) {
  return useQuery<CreatorRow[]>({
    queryKey: ['admin', 'creators', sortBy, limit],
    queryFn: () => getCreatorLeaderboard(sortBy, limit),
    staleTime: STALE_TIME,
    placeholderData: [],
  });
}

export function useRevenueChart(timeRange: TimeRange) {
  return useQuery<RevenueDataPoint[]>({
    queryKey: ['admin', 'revenue', timeRange],
    queryFn: () => getRevenueTimeSeries(timeRange),
    staleTime: STALE_TIME,
    placeholderData: [],
  });
}

export function useEnrollmentChart(timeRange: TimeRange) {
  return useQuery<EnrollmentTrendPoint[]>({
    queryKey: ['admin', 'enrollments', timeRange],
    queryFn: () => getEnrollmentTrends(timeRange),
    staleTime: STALE_TIME,
    placeholderData: [],
  });
}

export function useCommunityHealth() {
  return useQuery<CommunityRow[]>({
    queryKey: ['admin', 'communities'],
    queryFn: () => getCommunityHealth(),
    staleTime: STALE_TIME,
    placeholderData: [],
  });
}
