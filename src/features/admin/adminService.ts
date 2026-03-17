import { supabase } from '../../core/supabase/client';
import type {
  TimeRange,
  AdminOverviewStats,
  CreatorRow,
  RevenueDataPoint,
  EnrollmentTrendPoint,
  CommunityRow,
} from './types';

// ============================================================================
// HELPERS
// ============================================================================

function getDateFilter(range: TimeRange): string | null {
  if (range === 'all') return null;
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function groupByDay(items: { date: string }[]): Map<string, typeof items> {
  const map = new Map<string, typeof items>();
  for (const item of items) {
    const day = item.date.slice(0, 10);
    const arr = map.get(day) ?? [];
    arr.push(item);
    map.set(day, arr);
  }
  return map;
}

// ============================================================================
// OVERVIEW STATS
// ============================================================================

export async function getAdminOverviewStats(range: TimeRange): Promise<AdminOverviewStats> {
  const dateFilter = getDateFilter(range);

  const [
    creatorsResult,
    billingResult,
    studentsResult,
    enrollmentsResult,
    salesResult,
    activeBillingResult,
    communitiesResult,
    membershipsResult,
    postsResult,
    atRiskResult,
  ] = await Promise.all([
    // Total creators
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'creator'),

    // Creator billing with plan names
    supabase
      .from('creator_billing')
      .select('plan_id, billing_plans(name)')
      .eq('status', 'active'),

    // Total students
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .in('role', ['student', 'member']),

    // Enrollments
    (() => {
      let q = supabase
        .from('enrollments')
        .select('id, status, enrolled_at');
      if (dateFilter) {
        q = q.gte('enrolled_at', dateFilter);
      }
      return q;
    })(),

    // Sales
    (() => {
      let q = supabase
        .from('creator_sales')
        .select('sale_amount_cents, platform_fee_cents, status, created_at')
        .eq('status', 'completed');
      if (dateFilter) {
        q = q.gte('created_at', dateFilter);
      }
      return q;
    })(),

    // Active billing for MRR
    supabase
      .from('creator_billing')
      .select('plan_id, billing_plans(monthly_price_cents)')
      .eq('status', 'active'),

    // Communities
    supabase
      .from('communities')
      .select('id, is_public'),

    // Memberships for avg
    supabase
      .from('memberships')
      .select('id', { count: 'exact', head: true }),

    // Posts
    supabase
      .from('posts')
      .select('id', { count: 'exact', head: true }),

    // At-risk students
    supabase
      .from('student_health')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'at_risk'),
  ]);

  // Creator count
  const totalCreators = creatorsResult.count ?? 0;

  // Plan breakdown
  const planCounts = { starter: 0, pro: 0, scale: 0 };
  const billingRows = billingResult.data ?? [];
  for (const row of billingRows) {
    const planName = ((row as any).billing_plans?.name ?? '').toLowerCase();
    if (planName.includes('starter') || planName.includes('activation')) {
      planCounts.starter++;
    } else if (planName.includes('pro')) {
      planCounts.pro++;
    } else if (planName.includes('scale')) {
      planCounts.scale++;
    }
  }

  const activeCreators = billingRows.length;
  const inactiveCreators = Math.max(0, totalCreators - activeCreators);

  // Students
  const totalStudents = studentsResult.count ?? 0;

  // Enrollments
  const enrollments = enrollmentsResult.data ?? [];
  const totalEnrollments = enrollments.length;
  const activeEnrollments = enrollments.filter(e => e.status === 'active').length;

  // Completion rate
  const completedEnrollments = enrollments.filter(e => e.status === 'completed').length;
  const avgCompletionRate = totalEnrollments > 0
    ? Math.round((completedEnrollments / totalEnrollments) * 100)
    : 0;

  // Sales
  const sales = salesResult.data ?? [];
  let totalPlatformRevenue = 0;
  let totalGrossRevenue = 0;
  for (const sale of sales) {
    totalPlatformRevenue += sale.platform_fee_cents ?? 0;
    totalGrossRevenue += sale.sale_amount_cents ?? 0;
  }
  const transactionCount = sales.length;

  // MRR
  let monthlyRecurringRevenue = 0;
  const activeBillingRows = activeBillingResult.data ?? [];
  for (const row of activeBillingRows) {
    monthlyRecurringRevenue += (row as any).billing_plans?.monthly_price_cents ?? 0;
  }

  // Communities
  const communities = communitiesResult.data ?? [];
  const totalCommunities = communities.length;
  const publicCommunities = communities.filter(c => c.is_public).length;
  const privateCommunities = totalCommunities - publicCommunities;

  // Avg members
  const totalMemberships = membershipsResult.count ?? 0;
  const avgMembersPerCommunity = totalCommunities > 0
    ? Math.round(totalMemberships / totalCommunities)
    : 0;

  // Posts
  const totalPosts = postsResult.count ?? 0;

  // At-risk
  const atRiskStudentCount = atRiskResult.count ?? 0;

  return {
    totalCreators,
    creatorsByPlan: planCounts,
    activeCreators,
    inactiveCreators,
    totalStudents,
    totalEnrollments,
    activeEnrollments,
    avgCompletionRate,
    atRiskStudentCount,
    totalPlatformRevenue,
    totalGrossRevenue,
    monthlyRecurringRevenue,
    transactionCount,
    totalCommunities,
    publicCommunities,
    privateCommunities,
    avgMembersPerCommunity,
    totalPosts,
  };
}

// ============================================================================
// CREATOR LEADERBOARD
// ============================================================================

export async function getCreatorLeaderboard(
  sortBy: string = 'revenue',
  limit: number = 20,
): Promise<CreatorRow[]> {
  // Fetch all creators
  const { data: creators } = await supabase
    .from('profiles')
    .select('id, full_name, email, last_sign_in_at')
    .eq('role', 'creator');

  if (!creators?.length) return [];

  const creatorIds = creators.map(c => c.id);

  // Batch-fetch related data in parallel
  const [salesResult, enrollmentsResult, communitiesResult, billingResult] = await Promise.all([
    supabase
      .from('creator_sales')
      .select('creator_id, sale_amount_cents')
      .in('creator_id', creatorIds)
      .eq('status', 'completed'),

    supabase
      .from('enrollments')
      .select('id, course_id, courses!inner(creator_id)')
      .in('courses.creator_id', creatorIds),

    supabase
      .from('communities')
      .select('id, creator_id')
      .in('creator_id', creatorIds),

    supabase
      .from('creator_billing')
      .select('creator_id, billing_plans(name)')
      .in('creator_id', creatorIds),
  ]);

  // Aggregate sales by creator
  const salesByCreator = new Map<string, number>();
  for (const sale of salesResult.data ?? []) {
    const current = salesByCreator.get(sale.creator_id) ?? 0;
    salesByCreator.set(sale.creator_id, current + (sale.sale_amount_cents ?? 0));
  }

  // Aggregate enrollments by creator
  const enrollmentsByCreator = new Map<string, number>();
  for (const enrollment of enrollmentsResult.data ?? []) {
    const creatorId = (enrollment as any).courses?.creator_id;
    if (creatorId) {
      enrollmentsByCreator.set(creatorId, (enrollmentsByCreator.get(creatorId) ?? 0) + 1);
    }
  }

  // Aggregate communities by creator
  const communitiesByCreator = new Map<string, number>();
  for (const community of communitiesResult.data ?? []) {
    communitiesByCreator.set(
      community.creator_id,
      (communitiesByCreator.get(community.creator_id) ?? 0) + 1,
    );
  }

  // Plan by creator
  const planByCreator = new Map<string, string>();
  for (const billing of billingResult.data ?? []) {
    const planName = (billing as any).billing_plans?.name ?? 'none';
    planByCreator.set(billing.creator_id, planName);
  }

  // Build rows
  const rows: CreatorRow[] = creators.map(c => ({
    id: c.id,
    name: c.full_name ?? 'Unknown',
    email: c.email ?? '',
    plan: planByCreator.get(c.id) ?? 'none',
    totalRevenue: salesByCreator.get(c.id) ?? 0,
    studentCount: enrollmentsByCreator.get(c.id) ?? 0,
    communityCount: communitiesByCreator.get(c.id) ?? 0,
    lastLogin: c.last_sign_in_at ?? null,
  }));

  // Sort
  rows.sort((a, b) => {
    switch (sortBy) {
      case 'revenue': return b.totalRevenue - a.totalRevenue;
      case 'students': return b.studentCount - a.studentCount;
      case 'communities': return b.communityCount - a.communityCount;
      default: return b.totalRevenue - a.totalRevenue;
    }
  });

  return rows.slice(0, limit);
}

// ============================================================================
// REVENUE TIME SERIES
// ============================================================================

export async function getRevenueTimeSeries(range: TimeRange): Promise<RevenueDataPoint[]> {
  const dateFilter = getDateFilter(range);

  let query = supabase
    .from('creator_sales')
    .select('created_at, platform_fee_cents, sale_amount_cents')
    .eq('status', 'completed')
    .order('created_at', { ascending: true });

  if (dateFilter) {
    query = query.gte('created_at', dateFilter);
  }

  const { data: sales } = await query;
  if (!sales?.length) return [];

  // Group by day
  const dayMap = new Map<string, { platform: number; gross: number }>();
  for (const sale of sales) {
    const day = sale.created_at.slice(0, 10);
    const entry = dayMap.get(day) ?? { platform: 0, gross: 0 };
    entry.platform += sale.platform_fee_cents ?? 0;
    entry.gross += sale.sale_amount_cents ?? 0;
    dayMap.set(day, entry);
  }

  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date,
      platformRevenue: vals.platform,
      grossRevenue: vals.gross,
    }));
}

// ============================================================================
// ENROLLMENT TRENDS
// ============================================================================

export async function getEnrollmentTrends(range: TimeRange): Promise<EnrollmentTrendPoint[]> {
  const dateFilter = getDateFilter(range);

  let query = supabase
    .from('enrollments')
    .select('enrolled_at')
    .order('enrolled_at', { ascending: true });

  if (dateFilter) {
    query = query.gte('enrolled_at', dateFilter);
  }

  const { data: enrollments } = await query;
  if (!enrollments?.length) return [];

  // Group by day
  const dayMap = new Map<string, number>();
  for (const e of enrollments) {
    const day = e.enrolled_at.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }

  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({
      date,
      newEnrollments: count,
    }));
}

// ============================================================================
// COMMUNITY HEALTH
// ============================================================================

export async function getCommunityHealth(): Promise<CommunityRow[]> {
  // Fetch communities with creator profiles
  const [communitiesResult, membershipsResult, postsResult] = await Promise.all([
    supabase
      .from('communities')
      .select('id, name, creator_id, is_public, pricing_type, created_at, profiles!creator_id(full_name)')
      .order('created_at', { ascending: false }),

    supabase
      .from('memberships')
      .select('community_id'),

    supabase
      .from('posts')
      .select('community_id'),
  ]);

  const communities = communitiesResult.data ?? [];
  if (!communities.length) return [];

  // Count members per community
  const memberCounts = new Map<string, number>();
  for (const m of membershipsResult.data ?? []) {
    memberCounts.set(m.community_id, (memberCounts.get(m.community_id) ?? 0) + 1);
  }

  // Count posts per community
  const postCounts = new Map<string, number>();
  for (const p of postsResult.data ?? []) {
    postCounts.set(p.community_id, (postCounts.get(p.community_id) ?? 0) + 1);
  }

  return communities.map(c => ({
    id: c.id,
    name: c.name ?? 'Unnamed',
    creatorName: (c as any).profiles?.full_name ?? 'Unknown',
    memberCount: memberCounts.get(c.id) ?? 0,
    postCount: postCounts.get(c.id) ?? 0,
    pricingType: c.pricing_type ?? 'free',
    isPublic: c.is_public ?? true,
    createdAt: c.created_at,
  }));
}
