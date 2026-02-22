// ============================================================================
// TEAM SERVICE
// CRUD operations for community team member management
// ============================================================================

import { supabase } from '../../core/supabase/client';
import type {
  DbCommunityTeamMember,
  TeamMemberWithProfile,
  InviteTeamMemberInput,
  UpdateTeamMemberInput,
  PromoteToTeamInput,
} from './dmTypes';

// ============================================================================
// GET TEAM MEMBERS
// ============================================================================

/**
 * Get all team members for a community (with profile info)
 */
export async function getTeamMembers(communityId: string): Promise<TeamMemberWithProfile[]> {
  const { data, error } = await supabase
    .from('community_team_members')
    .select(`
      *,
      profile:profiles(*)
    `)
    .eq('community_id', communityId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching team members:', error);
    return [];
  }

  return (data as TeamMemberWithProfile[]) || [];
}

/**
 * Get a single team member by ID
 */
export async function getTeamMember(teamMemberId: string): Promise<TeamMemberWithProfile | null> {
  const { data, error } = await supabase
    .from('community_team_members')
    .select(`
      *,
      profile:profiles(*)
    `)
    .eq('id', teamMemberId)
    .single();

  if (error) {
    console.error('Error fetching team member:', error);
    return null;
  }

  return data as TeamMemberWithProfile;
}

/**
 * Get team members that are messageable
 */
export async function getMessageableTeamMembers(communityId: string): Promise<TeamMemberWithProfile[]> {
  const { data, error } = await supabase
    .from('community_team_members')
    .select(`
      *,
      profile:profiles(*)
    `)
    .eq('community_id', communityId)
    .eq('is_messageable', true)
    .eq('invite_status', 'accepted')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching messageable team members:', error);
    return [];
  }

  return (data as TeamMemberWithProfile[]) || [];
}

/**
 * Get pending invitations for a community
 */
export async function getPendingInvitations(communityId: string): Promise<DbCommunityTeamMember[]> {
  const { data, error } = await supabase
    .from('community_team_members')
    .select('*')
    .eq('community_id', communityId)
    .eq('invite_status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending invitations:', error);
    return [];
  }

  return data || [];
}

// ============================================================================
// INVITE TOKEN UTILITIES
// ============================================================================

const INVITE_BASE_URL = 'https://creatorclub.bg';

/**
 * Generate a unique invite token for a team member invitation
 * Returns token and expiration date (7 days from now)
 */
export function generateInviteToken(): { token: string; expiresAt: string } {
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  return { token, expiresAt: expiresAt.toISOString() };
}

// ============================================================================
// INVITE TEAM MEMBER
// ============================================================================

/**
 * Invite a new team member by email
 */
export async function inviteTeamMember(
  communityId: string,
  input: InviteTeamMemberInput
): Promise<{ success: boolean; data?: DbCommunityTeamMember; inviteLink?: string; error?: string }> {
  // Check if email already has a pending invite or is already a team member
  const { data: existing } = await supabase
    .from('community_team_members')
    .select('id, invite_status')
    .eq('community_id', communityId)
    .eq('invited_email', input.email)
    .single();

  if (existing) {
    return {
      success: false,
      error: existing.invite_status === 'pending'
        ? 'This email already has a pending invitation'
        : 'This email is already a team member'
    };
  }

  // Check if there's a user with this email who's already a team member
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', input.email)
    .single();

  if (existingProfile) {
    const { data: existingTeamMember } = await supabase
      .from('community_team_members')
      .select('id')
      .eq('community_id', communityId)
      .eq('profile_id', existingProfile.id)
      .single();

    if (existingTeamMember) {
      return { success: false, error: 'This user is already a team member' };
    }
  }

  // Generate invite token for pending invites
  const inviteData = generateInviteToken();

  // Create the invitation
  const { data, error } = await supabase
    .from('community_team_members')
    .insert({
      community_id: communityId,
      profile_id: existingProfile?.id || null,
      invited_email: existingProfile ? null : input.email,
      role: input.role,
      title: input.title || null,
      bio: input.bio || null,
      is_messageable: input.is_messageable ?? true,
      invite_status: existingProfile ? 'accepted' : 'pending',
      invite_token: existingProfile ? null : inviteData.token,
      invite_expires_at: existingProfile ? null : inviteData.expiresAt,
      invite_created_at: existingProfile ? null : new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error inviting team member:', error);
    return { success: false, error: 'Failed to send invitation' };
  }

  // TODO: Send invitation email if profile doesn't exist

  // Return with invite link for pending invites
  if (!existingProfile && data.invite_token) {
    return {
      success: true,
      data,
      inviteLink: `${INVITE_BASE_URL}/invite/team/${data.invite_token}`
    };
  }

  return { success: true, data };
}

/**
 * Create an invite link without requiring an email
 * This creates a pending invitation that can be shared with anyone
 */
export async function createInviteLink(
  communityId: string,
  input: Omit<InviteTeamMemberInput, 'email'>
): Promise<{ success: boolean; data?: DbCommunityTeamMember; inviteLink?: string; error?: string }> {
  // Generate invite token
  const inviteData = generateInviteToken();

  // Create the invitation without email - anyone with the link can accept
  const { data, error } = await supabase
    .from('community_team_members')
    .insert({
      community_id: communityId,
      profile_id: null,
      invited_email: null, // No email required
      role: input.role,
      title: input.title || null,
      bio: input.bio || null,
      is_messageable: input.is_messageable ?? true,
      invite_status: 'pending',
      invite_token: inviteData.token,
      invite_expires_at: inviteData.expiresAt,
      invite_created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating team invitation:', error);
    return { success: false, error: 'Failed to create invitation' };
  }

  const inviteLink = `${INVITE_BASE_URL}/invite/team/${data.invite_token}`;

  return {
    success: true,
    data,
    inviteLink
  };
}

// ============================================================================
// ADD TEAM MEMBER (PROMOTE EXISTING)
// ============================================================================

/**
 * Promote an existing community member to team member
 */
export async function addTeamMember(
  communityId: string,
  input: PromoteToTeamInput
): Promise<{ success: boolean; data?: DbCommunityTeamMember; error?: string }> {
  // Check if already a team member
  const { data: existing } = await supabase
    .from('community_team_members')
    .select('id')
    .eq('community_id', communityId)
    .eq('profile_id', input.profile_id)
    .single();

  if (existing) {
    return { success: false, error: 'This member is already on the team' };
  }

  // Verify the profile exists and is a member of the community
  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('community_id', communityId)
    .eq('user_id', input.profile_id)
    .single();

  if (!membership) {
    return { success: false, error: 'User must be a community member first' };
  }

  // Create the team member record
  const { data, error } = await supabase
    .from('community_team_members')
    .insert({
      community_id: communityId,
      profile_id: input.profile_id,
      role: input.role,
      title: input.title || null,
      bio: input.bio || null,
      is_messageable: input.is_messageable ?? true,
      invite_status: 'accepted',
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding team member:', error);
    return { success: false, error: 'Failed to add team member' };
  }

  return { success: true, data };
}

// ============================================================================
// UPDATE TEAM MEMBER
// ============================================================================

/**
 * Update a team member's details
 */
export async function updateTeamMember(
  teamMemberId: string,
  input: UpdateTeamMemberInput
): Promise<{ success: boolean; data?: DbCommunityTeamMember; error?: string }> {
  const updates: Partial<DbCommunityTeamMember> = {
    updated_at: new Date().toISOString(),
  };

  if (input.role !== undefined) updates.role = input.role;
  if (input.title !== undefined) updates.title = input.title;
  if (input.bio !== undefined) updates.bio = input.bio;
  if (input.is_messageable !== undefined) updates.is_messageable = input.is_messageable;

  const { data, error } = await supabase
    .from('community_team_members')
    .update(updates)
    .eq('id', teamMemberId)
    .select()
    .single();

  if (error) {
    console.error('Error updating team member:', error);
    return { success: false, error: 'Failed to update team member' };
  }

  return { success: true, data };
}

// ============================================================================
// DELETE TEAM MEMBER
// ============================================================================

/**
 * Remove a team member from the community
 */
export async function removeTeamMember(
  teamMemberId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('community_team_members')
    .delete()
    .eq('id', teamMemberId);

  if (error) {
    console.error('Error removing team member:', error);
    return { success: false, error: 'Failed to remove team member' };
  }

  return { success: true };
}

/**
 * Cancel a pending invitation
 */
export async function cancelInvitation(
  teamMemberId: string
): Promise<{ success: boolean; error?: string }> {
  // Only delete if it's a pending invite
  const { error } = await supabase
    .from('community_team_members')
    .delete()
    .eq('id', teamMemberId)
    .eq('invite_status', 'pending');

  if (error) {
    console.error('Error canceling invitation:', error);
    return { success: false, error: 'Failed to cancel invitation' };
  }

  return { success: true };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a profile is a team member in a community
 */
export async function isTeamMember(
  communityId: string,
  profileId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('community_team_members')
    .select('id')
    .eq('community_id', communityId)
    .eq('profile_id', profileId)
    .eq('invite_status', 'accepted')
    .single();

  if (error) {
    return false;
  }

  return !!data;
}

/**
 * Get the team member record for a profile in a community
 */
export async function getTeamMemberByProfile(
  communityId: string,
  profileId: string
): Promise<TeamMemberWithProfile | null> {
  const { data, error } = await supabase
    .from('community_team_members')
    .select(`
      *,
      profile:profiles(*)
    `)
    .eq('community_id', communityId)
    .eq('profile_id', profileId)
    .single();

  if (error) {
    return null;
  }

  return data as TeamMemberWithProfile;
}

// ============================================================================
// PROFILE PAGE DATA
// ============================================================================

/**
 * Get team member profile data for the profile page
 * Includes community info and courses they teach
 */
export async function getTeamMemberProfile(
  communityId: string,
  teamMemberId: string
): Promise<{
  teamMember: TeamMemberWithProfile;
  community: { id: string; name: string };
  courses: Array<{ id: string; title: string; thumbnail_url: string | null }>;
} | null> {
  // Get team member with profile
  const { data: teamMember, error: memberError } = await supabase
    .from('community_team_members')
    .select(`
      *,
      profile:profiles(*)
    `)
    .eq('id', teamMemberId)
    .eq('community_id', communityId)
    .single();

  if (memberError) {
    console.error('Error fetching team member:', memberError);
    return null;
  }

  // Get community info
  const { data: community, error: communityError } = await supabase
    .from('communities')
    .select('id, name')
    .eq('id', communityId)
    .single();

  if (communityError) {
    console.error('Error fetching community:', communityError);
    return null;
  }

  // Get courses where this team member is the instructor (creator)
  const courses: Array<{ id: string; title: string; thumbnail_url: string | null }> = [];

  if (teamMember.profile_id) {
    const { data: courseData, error: coursesError } = await supabase
      .from('courses')
      .select('id, title, thumbnail_url')
      .eq('community_id', communityId)
      .eq('creator_id', teamMember.profile_id)
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (!coursesError && courseData) {
      courses.push(...courseData);
    }
  }

  return {
    teamMember: teamMember as TeamMemberWithProfile,
    community,
    courses,
  };
}

/**
 * Get the instructor/team member for a specific course
 * Returns the team member if the course creator is a team member in the community
 */
export async function getCourseInstructor(
  courseId: string
): Promise<TeamMemberWithProfile | null> {
  // First get the course to find creator and community
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('creator_id, community_id')
    .eq('id', courseId)
    .single();

  if (courseError || !course?.community_id) {
    console.error('Error fetching course:', courseError);
    return null;
  }

  // Check if creator is a team member in the community
  const { data: teamMember, error: memberError } = await supabase
    .from('community_team_members')
    .select(`
      *,
      profile:profiles(*)
    `)
    .eq('community_id', course.community_id)
    .eq('profile_id', course.creator_id)
    .eq('invite_status', 'accepted')
    .single();

  if (memberError) {
    // Not a team member or not found - that's OK
    return null;
  }

  return teamMember as TeamMemberWithProfile;
}

/**
 * Get total unread message count for a student in a community
 */
export async function getUnreadCountForStudent(
  communityId: string,
  studentProfileId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('direct_conversations')
    .select('unread_count_student')
    .eq('community_id', communityId)
    .eq('student_profile_id', studentProfileId);

  if (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }

  return (data || []).reduce((sum, conv) => sum + (conv.unread_count_student || 0), 0);
}

/**
 * Get team members with their unread counts for sidebar display
 */
export async function getTeamMembersWithUnread(
  communityId: string,
  studentProfileId: string
): Promise<TeamMemberWithProfile[]> {
  // Get all messageable team members
  const teamMembers = await getMessageableTeamMembers(communityId);

  if (teamMembers.length === 0) {
    return [];
  }

  // Get conversations for this student to get unread counts
  const { data: conversations, error } = await supabase
    .from('direct_conversations')
    .select('team_member_id, unread_count_student')
    .eq('community_id', communityId)
    .eq('student_profile_id', studentProfileId);

  if (error) {
    console.error('Error fetching conversations:', error);
    // Return team members without unread counts
    return teamMembers;
  }

  // Map unread counts to team members
  const unreadMap = new Map<string, number>();
  (conversations || []).forEach(conv => {
    unreadMap.set(conv.team_member_id, conv.unread_count_student || 0);
  });

  return teamMembers.map(member => ({
    ...member,
    unread_count: unreadMap.get(member.id) || 0,
  }));
}

// ============================================================================
// INVITE TOKEN OPERATIONS
// ============================================================================

/**
 * Get a team member invitation by its token
 * Returns null if not found, expired, or already accepted
 */
export async function getInviteByToken(token: string): Promise<{
  invite: DbCommunityTeamMember | null;
  community: { id: string; name: string; logo_url: string | null } | null;
  creator: { full_name: string | null } | null;
  error?: string;
}> {
  // Query the invite with community and creator info
  const { data: invite, error } = await supabase
    .from('community_team_members')
    .select('*')
    .eq('invite_token', token)
    .single();

  if (error || !invite) {
    return { invite: null, community: null, creator: null, error: 'Invitation not found' };
  }

  // Check if invite is still pending
  if (invite.invite_status !== 'pending') {
    return { invite: null, community: null, creator: null, error: 'This invitation has already been used' };
  }

  // Check if invite has expired
  if (invite.invite_expires_at && new Date(invite.invite_expires_at) < new Date()) {
    return { invite: null, community: null, creator: null, error: 'This invitation has expired' };
  }

  // Get community info
  const { data: community, error: communityError } = await supabase
    .from('communities')
    .select('id, name, thumbnail_url, creator_id')
    .eq('id', invite.community_id)
    .single();

  if (communityError || !community) {
    return { invite: null, community: null, creator: null, error: 'Community not found' };
  }

  // Get creator info
  const { data: creator } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', community.creator_id)
    .single();

  return {
    invite: invite as DbCommunityTeamMember,
    community: { id: community.id, name: community.name, logo_url: community.thumbnail_url },
    creator: creator || null
  };
}

/**
 * Accept a team invitation
 * Uses a secure database function that:
 * - Validates the user is a student (not creator)
 * - Validates the invite exists and is pending
 * - Checks the invite hasn't expired
 * - Ensures user isn't already a team member
 * - Creates membership automatically if needed
 *
 * The database function uses SECURITY DEFINER to bypass RLS for internal checks
 * while still enforcing all business rules.
 */
export async function acceptTeamInvitation(
  token: string,
  profileId: string,
  userRole: string
): Promise<{ success: boolean; communityId?: string; error?: string; errorCode?: string }> {
  // Pre-check on client side for better UX (db function also validates)
  if (userRole !== 'student') {
    return {
      success: false,
      error: 'Only student accounts can join as team members. Please use a student account.',
      errorCode: 'CREATOR_NOT_ALLOWED'
    };
  }

  // Call the secure database function
  const { data, error } = await supabase
    .rpc('accept_team_invitation', {
      p_token: token,
      p_profile_id: profileId
    });

  if (error) {
    console.error('Error calling accept_team_invitation:', error);
    return {
      success: false,
      error: 'Failed to accept invitation',
      errorCode: 'RPC_ERROR'
    };
  }

  // Parse the JSONB response from the function
  const result = data as {
    success: boolean;
    community_id?: string;
    error?: string;
    error_code?: string;
    details?: string;
  };

  if (!result.success) {
    console.error('Team invitation acceptance failed:', result.error_code, result.error, result.details);
    return {
      success: false,
      error: result.error || 'Failed to accept invitation',
      errorCode: result.error_code
    };
  }

  return {
    success: true,
    communityId: result.community_id
  };
}

/**
 * Revoke/cancel a pending team invitation
 */
export async function revokeTeamInvitation(
  teamMemberId: string
): Promise<{ success: boolean; error?: string }> {
  // Only delete if it's a pending invite
  const { error } = await supabase
    .from('community_team_members')
    .delete()
    .eq('id', teamMemberId)
    .eq('invite_status', 'pending');

  if (error) {
    console.error('Error revoking team invitation:', error);
    return { success: false, error: 'Failed to revoke invitation' };
  }

  return { success: true };
}

/**
 * Get the invite link for an existing pending invitation
 */
export async function getInviteLink(teamMemberId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('community_team_members')
    .select('invite_token, invite_status')
    .eq('id', teamMemberId)
    .single();

  if (error || !data) {
    return null;
  }

  // Only return link if pending and has a token
  if (data.invite_status === 'pending' && data.invite_token) {
    return `${INVITE_BASE_URL}/invite/team/${data.invite_token}`;
  }

  return null;
}
