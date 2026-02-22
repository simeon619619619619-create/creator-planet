import { useQuery } from '@tanstack/react-query';
import {
  getDashboardStats,
  getAtRiskStudents,
  getWeeklyActivityData,
  getStudentsWithMissingHomework,
  getCreatorCommunityIds,
  DashboardStats,
  AtRiskStudent,
  ActivityDataPoint,
  StudentHomeworkStatus,
} from '../dashboardService';

interface DashboardData {
  stats: DashboardStats;
  atRiskStudents: AtRiskStudent[];
  activityData: ActivityDataPoint[];
  studentsWithMissingHomework: StudentHomeworkStatus[];
}

const defaultStats: DashboardStats = {
  totalStudents: 0,
  activeStudents: 0,
  completionRate: 0,
  atRiskCount: 0,
  inactiveCount: 0,
  totalCommunityMembers: 0,
  totalPosts: 0,
  homeworkTotalAssignments: 0,
  homeworkTotalSubmissions: 0,
  homeworkExpectedSubmissions: 0,
  totalStudentsChange: null,
  activeStudentsChange: null,
  completionRateChange: null,
  communityMembersChange: null,
};

export function useDashboardData(creatorProfileId: string | undefined, selectedCommunityId: string | null) {
  return useQuery<DashboardData>({
    queryKey: ['dashboard', creatorProfileId, selectedCommunityId],
    queryFn: async () => {
      if (!creatorProfileId) throw new Error('No creator profile ID');

      const communityIds = await getCreatorCommunityIds(creatorProfileId, selectedCommunityId);

      const [stats, atRiskStudents, activityData, studentsWithMissingHomework] = await Promise.all([
        getDashboardStats(creatorProfileId, selectedCommunityId, communityIds),
        getAtRiskStudents(creatorProfileId, selectedCommunityId),
        getWeeklyActivityData(creatorProfileId, selectedCommunityId),
        getStudentsWithMissingHomework(creatorProfileId, selectedCommunityId, communityIds),
      ]);

      return { stats, atRiskStudents, activityData, studentsWithMissingHomework };
    },
    enabled: !!creatorProfileId,
    staleTime: 2 * 60 * 1000, // 2 minutes for dashboard data
    placeholderData: {
      stats: defaultStats,
      atRiskStudents: [],
      activityData: [],
      studentsWithMissingHomework: [],
    },
  });
}
