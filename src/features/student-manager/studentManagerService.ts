import { supabase } from '../../core/supabase/client';
import { DbProfile, DbPoints } from '../../core/supabase/database.types';
import { awardPoints } from '../community/pointsService';

// ============================================================================
// STUDENT MANAGER SERVICE
// Provides functions to manage students and award bonus points
// ============================================================================

/**
 * Student with their stats including points and submission counts
 */
export interface StudentWithStats {
  profile: DbProfile;
  points: DbPoints | null;
  submissionCount: number;
  gradedCount: number;
}

/**
 * Community info for student display
 */
export interface CommunityInfo {
  id: string;
  name: string;
}

/**
 * Payment and discount info per community membership
 */
export interface MembershipPaymentInfo {
  communityId: string;
  communityName: string;
  planType: 'free' | 'one_time' | 'monthly' | 'canceled';
  expiresAt: string | null;
  paidAt: string | null;
  amountCents: number | null;
  discountCode: string | null;
  discountPercent: number | null;
  assignedCode: string | null;
  assignedCodePercent: number | null;
}

/**
 * Student with stats and community memberships (for cross-community view)
 */
export interface StudentWithCommunities extends StudentWithStats {
  communities: CommunityInfo[];
  membershipPayments: MembershipPaymentInfo[];
}

/**
 * Paginated result for students
 */
export interface PaginatedStudents {
  students: StudentWithCommunities[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Gets all members of a community with their points and submission counts
 * @param communityId - The community's ID
 * @returns Array of students with their stats
 */
export async function getStudentsWithStats(communityId: string): Promise<StudentWithStats[]> {
  // Get all memberships for this community with profile info
  const { data: memberships, error: membershipsError } = await supabase
    .from('memberships')
    .select(`
      user_id,
      user:profiles!user_id(*)
    `)
    .eq('community_id', communityId);

  if (membershipsError) {
    console.error('Error fetching memberships:', membershipsError);
    return [];
  }

  if (!memberships || memberships.length === 0) {
    return [];
  }

  // Extract profile IDs
  const profileIds = memberships.map((m: any) => m.user_id);

  // Get points for all members in this community
  const { data: pointsData, error: pointsError } = await supabase
    .from('points')
    .select('*')
    .eq('community_id', communityId)
    .in('user_id', profileIds);

  if (pointsError) {
    console.error('Error fetching points:', pointsError);
  }

  // Create a map of user_id to points
  const pointsMap = new Map<string, DbPoints>();
  (pointsData || []).forEach((p) => {
    pointsMap.set(p.user_id, p);
  });

  // Get submission counts for all members
  // First, get all assignments for this community
  const { data: assignments, error: assignmentsError } = await supabase
    .from('homework_assignments')
    .select('id')
    .eq('community_id', communityId);

  if (assignmentsError) {
    console.error('Error fetching assignments:', assignmentsError);
  }

  const assignmentIds = (assignments || []).map((a) => a.id);

  // Get submission stats per student
  const submissionStats = new Map<string, { total: number; graded: number }>();

  if (assignmentIds.length > 0) {
    const { data: submissions, error: submissionsError } = await supabase
      .from('homework_submissions')
      .select('student_id, status')
      .in('assignment_id', assignmentIds)
      .in('student_id', profileIds);

    if (submissionsError) {
      console.error('Error fetching submissions:', submissionsError);
    }

    // Calculate submission stats
    (submissions || []).forEach((sub) => {
      const stats = submissionStats.get(sub.student_id) || { total: 0, graded: 0 };
      stats.total++;
      if (sub.status === 'graded') {
        stats.graded++;
      }
      submissionStats.set(sub.student_id, stats);
    });
  }

  // Build the result array
  const students: StudentWithStats[] = memberships.map((m: any) => {
    const profile = m.user as DbProfile;
    const stats = submissionStats.get(profile.id) || { total: 0, graded: 0 };

    return {
      profile,
      points: pointsMap.get(profile.id) || null,
      submissionCount: stats.total,
      gradedCount: stats.graded,
    };
  });

  // Sort by points (highest first), then by name
  students.sort((a, b) => {
    const pointsA = a.points?.total_points || 0;
    const pointsB = b.points?.total_points || 0;
    if (pointsB !== pointsA) return pointsB - pointsA;
    const nameA = a.profile.full_name || '';
    const nameB = b.profile.full_name || '';
    return nameA.localeCompare(nameB);
  });

  return students;
}

/**
 * Gets all students across all communities owned by a creator with pagination
 * @param creatorId - The creator's profile ID
 * @param page - Page number (1-indexed)
 * @param pageSize - Number of students per page
 * @param searchQuery - Optional search query for name/email filtering
 * @param communityId - Optional community ID to filter by (empty = all communities)
 * @returns Paginated students with their community memberships
 */
export async function getAllCreatorStudents(
  creatorId: string,
  page: number = 1,
  pageSize: number = 10,
  searchQuery: string = '',
  communityId: string = ''
): Promise<PaginatedStudents> {
  // First, get all communities owned by the creator
  const { data: communities, error: communitiesError } = await supabase
    .from('communities')
    .select('id, name')
    .eq('creator_id', creatorId);

  if (communitiesError || !communities || communities.length === 0) {
    console.error('Error fetching communities:', communitiesError);
    return { students: [], totalCount: 0, page, pageSize, totalPages: 0 };
  }

  // Filter to specific community if provided, otherwise use all
  const communityIds = communityId
    ? communities.filter((c) => c.id === communityId).map((c) => c.id)
    : communities.map((c) => c.id);

  // If filtering by specific community but it doesn't exist, return empty
  if (communityId && communityIds.length === 0) {
    return { students: [], totalCount: 0, page, pageSize, totalPages: 0 };
  }

  const communityMap = new Map(communities.map((c) => [c.id, c.name]));

  // Get all unique students across these communities
  // Using a query that fetches memberships with profile data + payment fields
  let query = supabase
    .from('memberships')
    .select(`
      user_id,
      community_id,
      payment_status,
      stripe_subscription_id,
      expires_at,
      paid_at,
      user:profiles!user_id(*)
    `, { count: 'exact' })
    .in('community_id', communityIds);

  const { data: allMemberships, error: membershipsError, count: rawCount } = await query;

  if (membershipsError) {
    console.error('Error fetching memberships:', membershipsError);
    return { students: [], totalCount: 0, page, pageSize, totalPages: 0 };
  }

  // Group memberships by user to get unique students with their communities
  const studentMap = new Map<string, {
    profile: DbProfile;
    communities: CommunityInfo[];
  }>();

  // Also track per-user per-community membership payment info
  type MembershipRaw = {
    communityId: string;
    paymentStatus: string;
    stripeSubscriptionId: string | null;
    expiresAt: string | null;
    paidAt: string | null;
  };
  const membershipPaymentRaw = new Map<string, MembershipRaw[]>();

  (allMemberships || []).forEach((m: any) => {
    const profile = m.user as DbProfile;
    if (!profile) return;

    const existing = studentMap.get(profile.id);
    const communityInfo: CommunityInfo = {
      id: m.community_id,
      name: communityMap.get(m.community_id) || 'Unknown',
    };

    if (existing) {
      existing.communities.push(communityInfo);
    } else {
      studentMap.set(profile.id, {
        profile,
        communities: [communityInfo],
      });
    }

    // Track membership payment info
    const raw: MembershipRaw = {
      communityId: m.community_id,
      paymentStatus: m.payment_status || 'none',
      stripeSubscriptionId: m.stripe_subscription_id,
      expiresAt: m.expires_at,
      paidAt: m.paid_at,
    };
    const existingPayments = membershipPaymentRaw.get(profile.id);
    if (existingPayments) {
      existingPayments.push(raw);
    } else {
      membershipPaymentRaw.set(profile.id, [raw]);
    }
  });

  // Convert to array and apply search filter
  let studentsArray = Array.from(studentMap.values());

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    studentsArray = studentsArray.filter(
      (s) =>
        s.profile.full_name?.toLowerCase().includes(query) ||
        s.profile.email.toLowerCase().includes(query)
    );
  }

  const totalCount = studentsArray.length;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Get all profile IDs for points/submission queries
  const allProfileIds = studentsArray.map((s) => s.profile.id);

  // Get points for all students across all communities (aggregate by community)
  const { data: pointsData, error: pointsError } = await supabase
    .from('points')
    .select('*')
    .in('community_id', communityIds)
    .in('user_id', allProfileIds);

  if (pointsError) {
    console.error('Error fetching points:', pointsError);
  }

  // Aggregate points per user (sum across all communities)
  const pointsMap = new Map<string, DbPoints>();
  (pointsData || []).forEach((p) => {
    const existing = pointsMap.get(p.user_id);
    if (existing) {
      // Sum points across communities
      existing.total_points += p.total_points;
      // Use highest level
      existing.level = Math.max(existing.level, p.level);
    } else {
      pointsMap.set(p.user_id, { ...p });
    }
  });

  // Get submission stats across all communities
  const { data: assignments, error: assignmentsError } = await supabase
    .from('homework_assignments')
    .select('id')
    .in('community_id', communityIds);

  if (assignmentsError) {
    console.error('Error fetching assignments:', assignmentsError);
  }

  const assignmentIds = (assignments || []).map((a) => a.id);
  const submissionStats = new Map<string, { total: number; graded: number }>();

  if (assignmentIds.length > 0) {
    const { data: submissions, error: submissionsError } = await supabase
      .from('homework_submissions')
      .select('student_id, status')
      .in('assignment_id', assignmentIds)
      .in('student_id', allProfileIds);

    if (submissionsError) {
      console.error('Error fetching submissions:', submissionsError);
    }

    (submissions || []).forEach((sub) => {
      const stats = submissionStats.get(sub.student_id) || { total: 0, graded: 0 };
      stats.total++;
      if (sub.status === 'graded') {
        stats.graded++;
      }
      submissionStats.set(sub.student_id, stats);
    });
  }

  // Fetch community purchases for amount info
  const purchaseMap = new Map<string, number>(); // key: `${buyerId}:${communityId}` → amountCents
  if (allProfileIds.length > 0) {
    const { data: purchases, error: purchasesError } = await supabase
      .from('community_purchases')
      .select('buyer_id, community_id, amount_cents')
      .in('buyer_id', allProfileIds)
      .in('community_id', communityIds)
      .eq('status', 'completed');

    if (purchasesError) {
      console.error('Error fetching community purchases:', purchasesError);
    }

    (purchases || []).forEach((p: any) => {
      purchaseMap.set(`${p.buyer_id}:${p.community_id}`, p.amount_cents);
    });
  }

  // Fetch discount redemptions (codes used by students)
  const redemptionMap = new Map<string, { code: string; percent: number }>(); // key: `${studentId}:${communityId}`
  if (allProfileIds.length > 0) {
    const { data: redemptions, error: redemptionsError } = await supabase
      .from('discount_redemptions')
      .select(`
        student_id,
        community_id,
        discount_code:discount_codes!discount_redemptions_discount_code_id_fkey(code, discount_percent)
      `)
      .in('student_id', allProfileIds)
      .in('community_id', communityIds);

    if (redemptionsError) {
      console.error('Error fetching discount redemptions:', redemptionsError);
    }

    (redemptions || []).forEach((r: any) => {
      if (r.discount_code) {
        redemptionMap.set(`${r.student_id}:${r.community_id}`, {
          code: r.discount_code.code,
          percent: r.discount_code.discount_percent,
        });
      }
    });
  }

  // Fetch assigned discount codes (codes targeted to specific students)
  const assignedCodeMap = new Map<string, { code: string; percent: number }>(); // key: profileId
  if (allProfileIds.length > 0) {
    const { data: assignedCodes, error: assignedCodesError } = await supabase
      .from('discount_codes')
      .select('target_student_id, code, discount_percent')
      .in('target_student_id', allProfileIds)
      .eq('is_active', true);

    if (assignedCodesError) {
      console.error('Error fetching assigned discount codes:', assignedCodesError);
    }

    (assignedCodes || []).forEach((c: any) => {
      assignedCodeMap.set(c.target_student_id, {
        code: c.code,
        percent: c.discount_percent,
      });
    });
  }

  // Build membership payment info per student
  const buildMembershipPayments = (profileId: string): MembershipPaymentInfo[] => {
    const rawPayments = membershipPaymentRaw.get(profileId) || [];
    return rawPayments.map((raw) => {
      let planType: MembershipPaymentInfo['planType'];
      if (raw.paymentStatus === 'canceled') {
        planType = 'canceled';
      } else if (raw.paymentStatus === 'paid' && raw.stripeSubscriptionId) {
        planType = 'monthly';
      } else if (raw.paymentStatus === 'paid') {
        planType = 'one_time';
      } else {
        planType = 'free';
      }

      const key = `${profileId}:${raw.communityId}`;
      const redemption = redemptionMap.get(key);
      const assignedCode = assignedCodeMap.get(profileId);

      return {
        communityId: raw.communityId,
        communityName: communityMap.get(raw.communityId) || 'Unknown',
        planType,
        expiresAt: raw.expiresAt,
        paidAt: raw.paidAt,
        amountCents: purchaseMap.get(key) ?? null,
        discountCode: redemption?.code ?? null,
        discountPercent: redemption?.percent ?? null,
        assignedCode: assignedCode?.code ?? null,
        assignedCodePercent: assignedCode?.percent ?? null,
      };
    });
  };

  // Build final student objects with all stats
  const studentsWithStats: StudentWithCommunities[] = studentsArray.map((s) => {
    const stats = submissionStats.get(s.profile.id) || { total: 0, graded: 0 };
    return {
      profile: s.profile,
      communities: s.communities,
      membershipPayments: buildMembershipPayments(s.profile.id),
      points: pointsMap.get(s.profile.id) || null,
      submissionCount: stats.total,
      gradedCount: stats.graded,
    };
  });

  // Sort by total points (highest first), then by name
  studentsWithStats.sort((a, b) => {
    const pointsA = a.points?.total_points || 0;
    const pointsB = b.points?.total_points || 0;
    if (pointsB !== pointsA) return pointsB - pointsA;
    const nameA = a.profile.full_name || '';
    const nameB = b.profile.full_name || '';
    return nameA.localeCompare(nameB);
  });

  // Apply pagination
  const startIndex = (page - 1) * pageSize;
  const paginatedStudents = studentsWithStats.slice(startIndex, startIndex + pageSize);

  return {
    students: paginatedStudents,
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Gets all communities owned by a creator (for filter dropdown)
 * @param creatorId - The creator's profile ID
 * @returns Array of community info objects
 */
export async function getCreatorCommunities(creatorId: string): Promise<CommunityInfo[]> {
  const { data: communities, error } = await supabase
    .from('communities')
    .select('id, name')
    .eq('creator_id', creatorId)
    .order('name');

  if (error) {
    console.error('Error fetching creator communities:', error);
    return [];
  }

  return (communities || []).map((c) => ({
    id: c.id,
    name: c.name,
  }));
}

/**
 * Awards bonus points to a student
 * @param profileId - The student's profile ID
 * @param communityId - The community's ID
 * @param points - Number of bonus points to award (1-10)
 * @param reason - Optional reason for the bonus points
 * @returns True if points were awarded successfully, false otherwise
 */
export async function addBonusPoints(
  profileId: string,
  communityId: string,
  points: number,
  reason: string
): Promise<boolean> {
  // Validate points range
  if (points < 1 || points > 10) {
    console.error('Bonus points must be between 1 and 10');
    return false;
  }

  // Use the existing awardPoints function
  const transaction = await awardPoints(
    profileId,
    communityId,
    points,
    reason || 'Bonus points from creator'
  );

  return transaction !== null;
}

/**
 * Removes a student from a community (creator-initiated)
 * Calls the remove-student edge function which handles:
 * - Stripe subscription cancellation (if active)
 * - Membership deletion
 * - Related data cleanup (groups, event attendees)
 *
 * @param communityId - The community to remove the student from
 * @param studentProfileId - The student's profile ID
 * @returns Object with success status and optional error message
 */
export async function removeStudentFromCommunity(
  communityId: string,
  studentProfileId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/remove-student`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ communityId, studentProfileId }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to remove student' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error removing student:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
}
