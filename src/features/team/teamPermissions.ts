import { TeamMembershipInfo } from '../../core/contexts/AuthContext';

export type TeamRole = 'lecturer' | 'assistant' | 'guest_expert';

/**
 * Check if a user can manage a community based on their role or team membership.
 *
 * @param role - User's profile role ('creator', 'student', etc.)
 * @param communityId - The community to check access for
 * @param teamMemberships - User's team memberships from AuthContext
 * @param allowedTeamRoles - Which team roles are allowed (default: lecturer, assistant)
 * @returns true if user can manage the community
 */
export function canManageCommunity(
  role: string | null,
  communityId: string | null | undefined,
  teamMemberships: TeamMembershipInfo[] | null,
  allowedTeamRoles: TeamRole[] = ['lecturer', 'assistant']
): boolean {
  // Creators can always manage
  if (role === 'creator' || role === 'superadmin') {
    return true;
  }

  // If no community specified, can't check team membership
  if (!communityId) {
    return false;
  }

  // Check if user is a team member with an allowed role in this community
  return teamMemberships?.some(
    tm => tm.communityId === communityId && allowedTeamRoles.includes(tm.role)
  ) ?? false;
}

/**
 * Get the user's team role in a specific community.
 *
 * @param communityId - The community to check
 * @param teamMemberships - User's team memberships from AuthContext
 * @returns The team role if found, null otherwise
 */
export function getTeamRoleInCommunity(
  communityId: string | null | undefined,
  teamMemberships: TeamMembershipInfo[] | null
): TeamRole | null {
  if (!communityId || !teamMemberships) {
    return null;
  }

  const membership = teamMemberships.find(tm => tm.communityId === communityId);
  return membership?.role ?? null;
}

/**
 * Check if user is a team member (any role) in a specific community.
 *
 * @param communityId - The community to check
 * @param teamMemberships - User's team memberships from AuthContext
 * @returns true if user is a team member in this community
 */
export function isTeamMemberInCommunity(
  communityId: string | null | undefined,
  teamMemberships: TeamMembershipInfo[] | null
): boolean {
  if (!communityId || !teamMemberships) {
    return false;
  }

  return teamMemberships.some(tm => tm.communityId === communityId);
}

/**
 * Check if user can view community members (lecturers, assistants, guest_experts can all view).
 */
export function canViewCommunityMembers(
  role: string | null,
  communityId: string | null | undefined,
  teamMemberships: TeamMembershipInfo[] | null
): boolean {
  return canManageCommunity(role, communityId, teamMemberships, ['lecturer', 'assistant', 'guest_expert']);
}

/**
 * Check if user can grade homework (lecturers and assistants only).
 */
export function canGradeHomework(
  role: string | null,
  communityId: string | null | undefined,
  teamMemberships: TeamMembershipInfo[] | null
): boolean {
  return canManageCommunity(role, communityId, teamMemberships, ['lecturer', 'assistant']);
}

/**
 * Check if user can create calendar events (lecturers and assistants only).
 */
export function canCreateEvents(
  role: string | null,
  communityId: string | null | undefined,
  teamMemberships: TeamMembershipInfo[] | null
): boolean {
  return canManageCommunity(role, communityId, teamMemberships, ['lecturer', 'assistant']);
}

/**
 * Check if user can award bonus points (lecturers and assistants only).
 */
export function canAwardPoints(
  role: string | null,
  communityId: string | null | undefined,
  teamMemberships: TeamMembershipInfo[] | null
): boolean {
  return canManageCommunity(role, communityId, teamMemberships, ['lecturer', 'assistant']);
}
