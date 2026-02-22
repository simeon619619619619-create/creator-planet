import { supabase } from '../../core/supabase/client';
import {
  DbProfile,
  DbStudentHealth,
  DbEnrollment,
  DbLessonProgress,
  StudentStatus,
} from '../../core/supabase/database.types';

// ============================================================================
// TYPES
// ============================================================================

export interface DashboardStats {
  totalStudents: number;        // Course enrollments
  activeStudents: number;       // Active course enrollments
  completionRate: number;
  atRiskCount: number;
  inactiveCount: number;
  // Community stats
  totalCommunityMembers: number;
  totalPosts: number;
  // Homework stats
  homeworkTotalAssignments: number;
  homeworkTotalSubmissions: number;
  homeworkExpectedSubmissions: number;
  // Week-over-week changes (null = no previous data to compare)
  totalStudentsChange: number | null;
  activeStudentsChange: number | null;
  completionRateChange: number | null;
  communityMembersChange: number | null;
}

export interface AtRiskStudent {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  risk_score: number;
  status: StudentStatus;
  reason: string;
  last_activity_at: string | null;
  course_title?: string;
  community_id?: string;
}

export interface ActivityDataPoint {
  name: string;
  active: number;
}

export interface StudentHomeworkStatus {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  totalAssignments: number;
  submittedCount: number;
  missingCount: number;
  communityIds: string[];
}

export interface StudentEventAttendance {
  id: string;
  title: string;
  start_time: string;
  event_type: string;
  attended: boolean;
  community_name?: string;
}

export interface StudentLectureProgress {
  events: StudentEventAttendance[];
  stats: {
    totalEvents: number;
    attendedEvents: number;
    attendanceRate: number;
  };
}

// ============================================================================
// SHARED HELPERS
// ============================================================================

/**
 * Get community IDs for a creator, optionally filtered to a single community.
 * This helper avoids duplicate queries when multiple functions need the same data.
 */
export async function getCreatorCommunityIds(
  creatorId: string,
  communityId: string | null = null
): Promise<string[]> {
  if (communityId) {
    return [communityId];
  }

  const { data: communities } = await supabase
    .from('communities')
    .select('id')
    .eq('creator_id', creatorId);

  return communities?.map(c => c.id) || [];
}

// ============================================================================
// DASHBOARD STATS
// ============================================================================

/**
 * Get dashboard stats for a creator, optionally filtered by community
 * @param creatorId - The creator's profile ID
 * @param communityId - Optional community ID to filter stats (null = all communities)
 * @param precomputedCommunityIds - Optional pre-computed community IDs to avoid duplicate query
 */
export async function getDashboardStats(
  creatorId: string,
  communityId: string | null = null,
  precomputedCommunityIds?: string[]
): Promise<DashboardStats> {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Use pre-computed community IDs if provided, otherwise fetch them
  const communityIds = precomputedCommunityIds ?? await getCreatorCommunityIds(creatorId, communityId);

  // Step 1: Get courses (needs creatorId, optionally communityId)
  let courseQuery = supabase
    .from('courses')
    .select('id')
    .eq('creator_id', creatorId);

  if (communityId) {
    courseQuery = courseQuery.eq('community_id', communityId);
  }

  const { data: courses } = await courseQuery;
  const courseIds = courses?.map(c => c.id) || [];

  // Step 2: Parallel batch - all independent queries that need courseIds and/or communityIds
  const [
    enrollmentResult,
    atRiskResult,
    inactiveResult,
    membershipResult,
    channelResult,
    assignmentResult,
  ] = await Promise.all([
    // Enrollments (needs courseIds)
    courseIds.length > 0
      ? supabase
          .from('enrollments')
          .select('id, user_id, status, enrolled_at, course_id')
          .in('course_id', courseIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    // At-risk count (needs courseIds)
    courseIds.length > 0
      ? supabase
          .from('student_health')
          .select('id')
          .in('course_id', courseIds)
          .in('status', ['at_risk'])
      : Promise.resolve({ data: [] as any[], error: null }),
    // Inactive count (needs courseIds)
    courseIds.length > 0
      ? supabase
          .from('student_health')
          .select('id')
          .in('course_id', courseIds)
          .or(`last_activity_at.is.null,last_activity_at.lt.${sevenDaysAgo}`)
      : Promise.resolve({ data: [] as any[], error: null }),
    // Memberships (needs communityIds)
    communityIds.length > 0
      ? supabase
          .from('memberships')
          .select('id, user_id, joined_at')
          .in('community_id', communityIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    // Channels (needs communityIds)
    communityIds.length > 0
      ? supabase
          .from('community_channels')
          .select('id')
          .in('community_id', communityIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    // Homework assignments (needs communityIds)
    communityIds.length > 0
      ? supabase
          .from('homework_assignments')
          .select('id, community_id')
          .in('community_id', communityIds)
          .eq('is_published', true)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  // Early return on enrollment error
  const enrollments = enrollmentResult.data || [];
  if (enrollmentResult.error) {
    console.error('Error fetching enrollments:', enrollmentResult.error);
    return {
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
  }

  // Step 3: Second parallel batch for queries that need results from Step 2
  const channelIds = channelResult.data?.map((c: any) => c.id) || [];
  const assignments = assignmentResult.data || [];
  const assignmentIds = assignments.map((a: any) => a.id);

  // Build communities-with-assignments for membership query
  const assignmentsByCommunity = new Map<string, number>();
  assignments.forEach((a: any) => {
    assignmentsByCommunity.set(
      a.community_id,
      (assignmentsByCommunity.get(a.community_id) || 0) + 1
    );
  });
  const communitiesWithAssignments = [...assignmentsByCommunity.keys()];

  const [postResult, submissionResult, hwMembershipResult] = await Promise.all([
    // Posts count (needs channelIds from Step 2)
    channelIds.length > 0
      ? supabase
          .from('posts')
          .select('id', { count: 'exact' })
          .in('channel_id', channelIds)
      : Promise.resolve({ data: [] as any[], count: 0, error: null }),
    // Homework submissions count (needs assignmentIds from Step 2)
    assignmentIds.length > 0
      ? supabase
          .from('homework_submissions')
          .select('id', { count: 'exact' })
          .in('assignment_id', assignmentIds)
      : Promise.resolve({ data: [] as any[], count: 0, error: null }),
    // Homework membership counts (needs communitiesWithAssignments from Step 2)
    communitiesWithAssignments.length > 0
      ? supabase
          .from('memberships')
          .select('community_id')
          .in('community_id', communitiesWithAssignments)
          .neq('user_id', creatorId)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  // ============================================================================
  // COMPUTE ENROLLMENT STATS (same logic as before)
  // ============================================================================

  const totalStudents = new Set(enrollments.map(e => e.user_id)).size;
  const activeEnrollments = enrollments.filter(e => e.status === 'active');
  const activeStudents = new Set(activeEnrollments.map(e => e.user_id)).size;
  const completedEnrollments = enrollments.filter(e => e.status === 'completed');
  const completionRate = enrollments.length > 0
    ? Math.round((completedEnrollments.length / enrollments.length) * 100)
    : 0;

  // Calculate week-over-week changes
  const newStudentsThisWeek = enrollments.filter(e =>
    new Date(e.enrolled_at) >= oneWeekAgo
  ).length;

  const newStudentsLastWeek = enrollments.filter(e => {
    const enrolledAt = new Date(e.enrolled_at);
    return enrolledAt >= twoWeeksAgo && enrolledAt < oneWeekAgo;
  }).length;

  let totalStudentsChange: number | null = null;
  if (newStudentsLastWeek > 0) {
    totalStudentsChange = Math.round(((newStudentsThisWeek - newStudentsLastWeek) / newStudentsLastWeek) * 100);
  } else if (newStudentsThisWeek > 0) {
    totalStudentsChange = 100;
  }

  // For active students and completion rate, we'd need historical snapshots
  // These will be null (meaning "no data") until we implement historical tracking
  const activeStudentsChange: number | null = null;
  const completionRateChange: number | null = null;

  // ============================================================================
  // COMPUTE AT-RISK / INACTIVE COUNTS
  // ============================================================================

  const atRiskCount = atRiskResult.data?.length || 0;
  const inactiveCount = inactiveResult.data?.length || 0;

  // ============================================================================
  // COMPUTE COMMUNITY STATS
  // ============================================================================

  let totalCommunityMembers = 0;
  let communityMembersChange: number | null = null;

  const memberships = membershipResult.data || [];
  if (memberships.length > 0) {
    const memberUserIds = new Set(memberships.map((m: any) => m.user_id));
    memberUserIds.delete(creatorId);
    totalCommunityMembers = memberUserIds.size;

    const newMembersThisWeek = memberships.filter((m: any) =>
      m.user_id !== creatorId && new Date(m.joined_at) >= oneWeekAgo
    ).length;

    const newMembersLastWeek = memberships.filter((m: any) => {
      if (m.user_id === creatorId) return false;
      const joinedAt = new Date(m.joined_at);
      return joinedAt >= twoWeeksAgo && joinedAt < oneWeekAgo;
    }).length;

    if (newMembersLastWeek > 0) {
      communityMembersChange = Math.round(((newMembersThisWeek - newMembersLastWeek) / newMembersLastWeek) * 100);
    } else if (newMembersThisWeek > 0) {
      communityMembersChange = 100;
    }
  }

  const totalPosts = (postResult as any).count || 0;

  // ============================================================================
  // COMPUTE HOMEWORK STATS
  // ============================================================================

  let homeworkTotalAssignments = 0;
  let homeworkTotalSubmissions = 0;
  let homeworkExpectedSubmissions = 0;

  if (!assignmentResult.error && assignments.length > 0) {
    homeworkTotalAssignments = assignments.length;
    homeworkTotalSubmissions = (submissionResult as any).count || 0;

    // Group membership counts by community locally
    const memberCountByCommunity = new Map<string, number>();
    (hwMembershipResult.data || []).forEach((m: any) => {
      memberCountByCommunity.set(
        m.community_id,
        (memberCountByCommunity.get(m.community_id) || 0) + 1
      );
    });

    // Calculate expected submissions using local counts
    for (const [commId, assignmentCount] of assignmentsByCommunity.entries()) {
      const memberCount = memberCountByCommunity.get(commId) || 0;
      homeworkExpectedSubmissions += memberCount * assignmentCount;
    }
  }

  return {
    totalStudents,
    activeStudents,
    completionRate,
    atRiskCount,
    inactiveCount,
    totalCommunityMembers,
    totalPosts,
    homeworkTotalAssignments,
    homeworkTotalSubmissions,
    homeworkExpectedSubmissions,
    totalStudentsChange,
    activeStudentsChange,
    completionRateChange,
    communityMembersChange,
  };
}

// ============================================================================
// AT-RISK STUDENTS
// ============================================================================

/**
 * Get at-risk students for a creator, optionally filtered by community
 * @param creatorId - The creator's profile ID
 * @param communityId - Optional community ID to filter (null = all communities)
 */
export async function getAtRiskStudents(
  creatorId: string,
  communityId: string | null = null
): Promise<AtRiskStudent[]> {
  // Get courses for filtering
  let courseQuery = supabase
    .from('courses')
    .select('id')
    .eq('creator_id', creatorId);

  if (communityId) {
    courseQuery = courseQuery.eq('community_id', communityId);
  }

  const { data: courses } = await courseQuery;
  const courseIds = courses?.map(c => c.id) || [];

  if (courseIds.length === 0) {
    return [];
  }

  // Get at-risk students from student_health table for filtered courses
  const { data: healthData, error: healthError } = await supabase
    .from('student_health')
    .select(`
      *,
      profile:profiles!user_id(*),
      course:courses!course_id(title, creator_id, community_id)
    `)
    .in('course_id', courseIds)
    .in('status', ['at_risk'])
    .order('risk_score', { ascending: false });

  if (healthError) {
    console.error('Error fetching at-risk students:', healthError);
    return [];
  }

  const filteredData = healthData || [];

  return filteredData.map(h => {
    const profile = h.profile as DbProfile;
    const course = h.course as any;

    return {
      id: h.id,
      user_id: h.user_id,
      name: profile?.full_name || profile?.email || 'Unknown',
      email: profile?.email || '',
      avatar_url: profile?.avatar_url,
      risk_score: h.risk_score,
      status: h.status,
      reason: generateRiskReason(h),
      last_activity_at: h.last_activity_at,
      course_title: course?.title,
      community_id: course?.community_id,
    };
  });
}

/**
 * Get students by status (at_risk, stable, top_member)
 */
export async function getStudentsByStatus(
  creatorId: string,
  status: StudentStatus
): Promise<AtRiskStudent[]> {
  const { data: healthData, error } = await supabase
    .from('student_health')
    .select(`
      *,
      profile:profiles!user_id(*),
      course:courses!course_id(title, creator_id)
    `)
    .eq('status', status)
    .order('risk_score', { ascending: status === 'at_risk' ? false : true });

  if (error) {
    console.error(`Error fetching ${status} students:`, error);
    return [];
  }

  // Filter to only include students from this creator's courses
  const filteredData = healthData?.filter(h => {
    const course = h.course as any;
    return course?.creator_id === creatorId;
  }) || [];

  return filteredData.map(h => {
    const profile = h.profile as DbProfile;
    const course = h.course as any;

    return {
      id: h.id,
      user_id: h.user_id,
      name: profile?.full_name || profile?.email || 'Unknown',
      email: profile?.email || '',
      avatar_url: profile?.avatar_url,
      risk_score: h.risk_score,
      status: h.status,
      reason: generateRiskReason(h),
      last_activity_at: h.last_activity_at,
      course_title: course?.title,
    };
  });
}

/**
 * Get all students regardless of status
 */
export async function getAllStudents(creatorId: string): Promise<AtRiskStudent[]> {
  const { data: healthData, error } = await supabase
    .from('student_health')
    .select(`
      *,
      profile:profiles!user_id(*),
      course:courses!course_id(title, creator_id)
    `)
    .order('status', { ascending: true })
    .order('risk_score', { ascending: false });

  if (error) {
    console.error('Error fetching all students:', error);
    return [];
  }

  // Filter to only include students from this creator's courses
  const filteredData = healthData?.filter(h => {
    const course = h.course as any;
    return course?.creator_id === creatorId;
  }) || [];

  return filteredData.map(h => {
    const profile = h.profile as DbProfile;
    const course = h.course as any;

    return {
      id: h.id,
      user_id: h.user_id,
      name: profile?.full_name || profile?.email || 'Unknown',
      email: profile?.email || '',
      avatar_url: profile?.avatar_url,
      risk_score: h.risk_score,
      status: h.status,
      reason: generateRiskReason(h),
      last_activity_at: h.last_activity_at,
      course_title: course?.title,
    };
  });
}

function generateRiskReason(health: DbStudentHealth & { last_activity_at: string | null }): string {
  const reasons: string[] = [];

  if (health.risk_score >= 80) {
    reasons.push('Very high risk score');
  } else if (health.risk_score >= 60) {
    reasons.push('Elevated risk score');
  }

  if (health.last_activity_at) {
    const lastActivity = new Date(health.last_activity_at);
    const daysSinceActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceActivity > 14) {
      reasons.push(`No activity for ${daysSinceActivity} days`);
    } else if (daysSinceActivity > 7) {
      reasons.push('Low activity in past week');
    }
  } else {
    reasons.push('Never active');
  }

  return reasons.length > 0 ? reasons.join('. ') : 'Needs attention';
}

// ============================================================================
// ACTIVITY DATA
// ============================================================================

/**
 * Get weekly activity data for a creator, optionally filtered by community
 * @param creatorId - The creator's profile ID
 * @param communityId - Optional community ID to filter (null = all communities)
 */
export async function getWeeklyActivityData(
  creatorId: string,
  communityId: string | null = null
): Promise<ActivityDataPoint[]> {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekAgoISO = weekAgo.toISOString();
  const todayISO = today.toISOString();

  // Initialize activity counts
  const activityByDay: Record<string, number> = {};
  days.forEach(day => { activityByDay[day] = 0; });

  // Step 1: Get communityIds and courses with nested modules/lessons in parallel
  // Build the courses query with nested select to replace 3 sequential queries
  let courseQuery = supabase
    .from('courses')
    .select('id, modules(id, lessons(id))')
    .eq('creator_id', creatorId);

  if (communityId) {
    courseQuery = courseQuery.eq('community_id', communityId);
  }

  const [communityIds, coursesResult] = await Promise.all([
    getCreatorCommunityIds(creatorId, communityId),
    courseQuery,
  ]);

  const coursesWithContent = coursesResult.data || [];

  // Extract all lesson IDs from the nested result
  const allLessonIds: string[] = [];
  coursesWithContent.forEach((course: any) => {
    (course.modules || []).forEach((mod: any) => {
      (mod.lessons || []).forEach((lesson: any) => {
        allLessonIds.push(lesson.id);
      });
    });
  });

  // Step 2: Parallel batch - channels + lesson progress (independent of each other)
  const [channelResult, progressResult] = await Promise.all([
    // Channels (needs communityIds)
    communityIds.length > 0
      ? supabase
          .from('community_channels')
          .select('id')
          .in('community_id', communityIds)
      : Promise.resolve({ data: [] as any[] }),
    // Lesson progress (needs lessonIds)
    allLessonIds.length > 0
      ? supabase
          .from('lesson_progress')
          .select('updated_at')
          .in('lesson_id', allLessonIds)
          .gte('updated_at', weekAgoISO)
          .lte('updated_at', todayISO)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  // Count lesson progress activity by day
  (progressResult.data || []).forEach((p: any) => {
    const date = new Date(p.updated_at);
    const dayName = days[date.getDay()];
    activityByDay[dayName] = (activityByDay[dayName] || 0) + 1;
  });

  const channelIds = channelResult.data?.map((c: any) => c.id) || [];

  // Step 3: Weekly posts (date-filtered) + post IDs (for comments join) in parallel
  if (channelIds.length > 0) {
    const [weeklyPostsResult, postIdsResult] = await Promise.all([
      // Weekly posts - date-filtered at DB level (no broad historical scan)
      supabase
        .from('posts')
        .select('created_at')
        .in('channel_id', channelIds)
        .gte('created_at', weekAgoISO)
        .lte('created_at', todayISO)
        .limit(10000),
      // All post IDs for channels (lightweight - single column, needed for comments join)
      supabase
        .from('posts')
        .select('id')
        .in('channel_id', channelIds)
        .limit(50000),
    ]);

    // Count weekly post activity by day
    (weeklyPostsResult.data || []).forEach(p => {
      const createdAt = new Date(p.created_at);
      const dayName = days[createdAt.getDay()];
      activityByDay[dayName] = (activityByDay[dayName] || 0) + 1;
    });

    // Get weekly comments using post IDs
    const postIds = (postIdsResult.data || []).map((p: { id: string }) => p.id);
    if (postIds.length > 0) {
      const { data: commentsData } = await supabase
        .from('post_comments')
        .select('created_at')
        .in('post_id', postIds)
        .gte('created_at', weekAgoISO)
        .lte('created_at', todayISO)
        .limit(10000);

      (commentsData || []).forEach(c => {
        const date = new Date(c.created_at);
        const dayName = days[date.getDay()];
        activityByDay[dayName] = (activityByDay[dayName] || 0) + 1;
      });
    }
  }

  // Reorder starting from today's day
  const todayIndex = today.getDay();
  const orderedDays = [...days.slice(todayIndex + 1), ...days.slice(0, todayIndex + 1)];

  return orderedDays.map(name => ({
    name,
    active: activityByDay[name] || 0,
  }));
}

// ============================================================================
// COMMUNITY STATS
// ============================================================================

/**
 * Get community stats for a creator, optionally filtered by community
 * @param creatorId - The creator's profile ID
 * @param communityId - Optional community ID to filter (null = all communities)
 */
export async function getCommunityStats(
  creatorId: string,
  communityId: string | null = null
): Promise<{
  totalMembers: number;
  totalPosts: number;
  totalComments: number;
}> {
  // Get community IDs (all or filtered)
  let communityIds: string[] = [];
  if (communityId) {
    communityIds = [communityId];
  } else {
    const { data: communities } = await supabase
      .from('communities')
      .select('id')
      .eq('creator_id', creatorId);
    communityIds = communities?.map(c => c.id) || [];
  }

  if (communityIds.length === 0) {
    return { totalMembers: 0, totalPosts: 0, totalComments: 0 };
  }

  // Count members
  const { count: memberCount } = await supabase
    .from('memberships')
    .select('id', { count: 'exact' })
    .in('community_id', communityIds);

  // Get channels for these communities
  const { data: channels } = await supabase
    .from('community_channels')
    .select('id')
    .in('community_id', communityIds);

  const channelIds = channels?.map(c => c.id) || [];

  // Count posts
  const { count: postCount } = channelIds.length > 0
    ? await supabase
        .from('posts')
        .select('id', { count: 'exact' })
        .in('channel_id', channelIds)
    : { count: 0 };

  // Count comments
  const { data: posts } = channelIds.length > 0
    ? await supabase
        .from('posts')
        .select('id')
        .in('channel_id', channelIds)
    : { data: [] };

  const postIds = posts?.map(p => p.id) || [];

  const { count: commentCount } = postIds.length > 0
    ? await supabase
        .from('post_comments')
        .select('id', { count: 'exact' })
        .in('post_id', postIds)
    : { count: 0 };

  return {
    totalMembers: memberCount || 0,
    totalPosts: postCount || 0,
    totalComments: commentCount || 0,
  };
}

// ============================================================================
// HOMEWORK STATS - INDIVIDUAL STUDENTS
// ============================================================================

/**
 * Get students with missing homework submissions
 * @param creatorId - The creator's profile ID
 * @param communityId - Optional community ID to filter (null = all communities)
 * @param precomputedCommunityIds - Optional pre-computed community IDs to avoid duplicate query
 * @param limit - Optional limit for number of students to return (default: 20)
 * @returns Array of students sorted by missing count (most missing first)
 */
export async function getStudentsWithMissingHomework(
  creatorId: string,
  communityId: string | null = null,
  precomputedCommunityIds?: string[],
  limit: number = 20
): Promise<StudentHomeworkStatus[]> {
  // Use pre-computed community IDs if provided, otherwise fetch them
  const communityIds = precomputedCommunityIds ?? await getCreatorCommunityIds(creatorId, communityId);

  if (communityIds.length === 0) {
    return [];
  }

  // Get all published assignments in the creator's communities
  const { data: assignments, error: assignmentsError } = await supabase
    .from('homework_assignments')
    .select('id, community_id')
    .in('community_id', communityIds)
    .eq('is_published', true);

  if (assignmentsError || !assignments || assignments.length === 0) {
    return [];
  }

  const assignmentIds = assignments.map(a => a.id);

  // Group assignments by community for counting
  const assignmentCountByCommunity = new Map<string, number>();
  assignments.forEach(a => {
    assignmentCountByCommunity.set(
      a.community_id,
      (assignmentCountByCommunity.get(a.community_id) || 0) + 1
    );
  });

  // Get members of communities with assignments (excluding creator)
  // Limit to 1000 memberships for performance - covers most use cases
  const communitiesWithAssignments = [...assignmentCountByCommunity.keys()];
  const { data: memberships, error: membershipsError } = await supabase
    .from('memberships')
    .select('user_id, community_id')
    .in('community_id', communitiesWithAssignments)
    .neq('user_id', creatorId)
    .limit(1000);

  if (membershipsError || !memberships || memberships.length === 0) {
    return [];
  }

  // Get submissions for these assignments
  // Limit to 5000 submissions for performance
  const { data: submissions } = await supabase
    .from('homework_submissions')
    .select('student_id, assignment_id')
    .in('assignment_id', assignmentIds)
    .limit(5000);

  // Create a set of "student_id:assignment_id" for quick lookup
  const submittedSet = new Set(
    (submissions || []).map(s => `${s.student_id}:${s.assignment_id}`)
  );

  // Calculate expected and submitted for each student
  // A student is expected to submit all assignments in communities they're a member of
  const studentStats = new Map<string, {
    userId: string;
    totalAssignments: number;
    submittedCount: number;
    communityIds: Set<string>;
  }>();

  memberships.forEach(m => {
    const existing = studentStats.get(m.user_id);
    if (existing) {
      existing.communityIds.add(m.community_id);
      existing.totalAssignments += assignmentCountByCommunity.get(m.community_id) || 0;
    } else {
      studentStats.set(m.user_id, {
        userId: m.user_id,
        totalAssignments: assignmentCountByCommunity.get(m.community_id) || 0,
        submittedCount: 0,
        communityIds: new Set([m.community_id]),
      });
    }
  });

  // Count submissions for each student
  // Only count submissions for assignments in communities they're a member of
  assignments.forEach(a => {
    studentStats.forEach((stats, studentId) => {
      if (stats.communityIds.has(a.community_id)) {
        if (submittedSet.has(`${studentId}:${a.id}`)) {
          stats.submittedCount++;
        }
      }
    });
  });

  // First, identify students with missing homework and sort by missing count
  // This avoids fetching profiles for students we won't display
  const studentsWithMissing: Array<{ profileId: string; stats: typeof studentStats extends Map<string, infer V> ? V : never; missingCount: number }> = [];

  studentStats.forEach((stats, profileId) => {
    const missingCount = stats.totalAssignments - stats.submittedCount;
    if (missingCount > 0) {
      studentsWithMissing.push({ profileId, stats, missingCount });
    }
  });

  // Sort by missing count (most missing first) and take only top `limit`
  studentsWithMissing.sort((a, b) => b.missingCount - a.missingCount);
  const topStudents = studentsWithMissing.slice(0, limit);

  if (topStudents.length === 0) {
    return [];
  }

  // Only fetch profiles for the students we'll actually return
  const topUserIds = topStudents.map(s => s.profileId);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, user_id, full_name, email, avatar_url')
    .in('id', topUserIds);

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  // Build final result with profile data
  return topStudents.map(({ profileId, stats, missingCount }) => {
    const profile = profileMap.get(profileId);
    return {
      id: profileId,
      user_id: profile?.user_id || profileId,
      name: profile?.full_name || profile?.email || 'Unknown',
      email: profile?.email || '',
      avatar_url: profile?.avatar_url || null,
      totalAssignments: stats.totalAssignments,
      submittedCount: stats.submittedCount,
      missingCount,
      communityIds: [...stats.communityIds],
    };
  });
}

// ============================================================================
// STUDENT LECTURE/EVENT ATTENDANCE
// ============================================================================

/**
 * Get a student's event/lecture attendance for communities they belong to
 * @param studentProfileId - The student's profile ID
 * @param communityIds - Community IDs to check attendance for
 * @returns Object with events list and attendance stats
 */
export async function getStudentLectureAttendance(
  studentProfileId: string,
  communityIds: string[]
): Promise<StudentLectureProgress> {
  if (communityIds.length === 0) {
    return {
      events: [],
      stats: { totalEvents: 0, attendedEvents: 0, attendanceRate: 0 },
    };
  }

  // Get all past events in the student's communities
  const now = new Date().toISOString();
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select(`
      id,
      title,
      start_time,
      event_type,
      community:communities(name)
    `)
    .in('community_id', communityIds)
    .lt('start_time', now)
    .order('start_time', { ascending: false });

  if (eventsError || !events || events.length === 0) {
    return {
      events: [],
      stats: { totalEvents: 0, attendedEvents: 0, attendanceRate: 0 },
    };
  }

  const eventIds = events.map(e => e.id);

  // Get the student's attendance records
  const { data: attendanceRecords } = await supabase
    .from('event_attendees')
    .select('event_id, attended')
    .eq('user_id', studentProfileId)
    .in('event_id', eventIds);

  const attendanceMap = new Map(
    (attendanceRecords || []).map(a => [a.event_id, a.attended])
  );

  // Build the events list with attendance status
  const eventsList: StudentEventAttendance[] = events.map(e => ({
    id: e.id,
    title: e.title,
    start_time: e.start_time,
    event_type: e.event_type,
    attended: attendanceMap.get(e.id) === true,
    community_name: (e.community as { name: string } | null)?.name,
  }));

  const totalEvents = eventsList.length;
  const attendedEvents = eventsList.filter(e => e.attended).length;
  const attendanceRate = totalEvents > 0
    ? Math.round((attendedEvents / totalEvents) * 100)
    : 0;

  return {
    events: eventsList,
    stats: {
      totalEvents,
      attendedEvents,
      attendanceRate,
    },
  };
}
