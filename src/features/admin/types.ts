export type TimeRange = '7d' | '30d' | '90d' | 'all';
export type AdminSection = 'overview' | 'creators' | 'students' | 'revenue' | 'communities';

export interface AdminOverviewStats {
  totalCreators: number;
  creatorsByPlan: { starter: number; pro: number; scale: number };
  activeCreators: number;
  inactiveCreators: number;
  totalStudents: number;
  totalEnrollments: number;
  activeEnrollments: number;
  avgCompletionRate: number;
  atRiskStudentCount: number;
  totalPlatformRevenue: number;
  totalGrossRevenue: number;
  monthlyRecurringRevenue: number;
  transactionCount: number;
  totalCommunities: number;
  publicCommunities: number;
  privateCommunities: number;
  avgMembersPerCommunity: number;
  totalPosts: number;
}

export interface CreatorRow {
  id: string;
  name: string;
  email: string;
  plan: string;
  totalRevenue: number;
  studentCount: number;
  communityCount: number;
  lastLogin: string | null;
}

export interface RevenueDataPoint {
  date: string;
  platformRevenue: number;
  grossRevenue: number;
}

export interface EnrollmentTrendPoint {
  date: string;
  newEnrollments: number;
}

export interface CommunityRow {
  id: string;
  name: string;
  creatorName: string;
  memberCount: number;
  postCount: number;
  pricingType: string;
  isPublic: boolean;
  createdAt: string;
}
