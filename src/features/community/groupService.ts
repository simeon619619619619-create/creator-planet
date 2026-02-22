import { supabase } from '../../core/supabase/client';
import type {
  DbCommunityGroup,
  DbCommunityGroupMember,
  DbCommunityGroupWithCount,
  DbProfile,
} from '../../core/supabase/database.types';

// ============================================================================
// GROUPS CRUD
// ============================================================================

/**
 * Get all groups for a community with member counts
 */
export async function getGroupsWithCounts(
  communityId: string
): Promise<DbCommunityGroupWithCount[]> {
  const { data: groups, error } = await supabase
    .from('community_groups')
    .select('*')
    .eq('community_id', communityId)
    .order('position', { ascending: true });

  if (error) {
    console.error('Error fetching groups:', error);
    return [];
  }

  // Get member counts for each group
  const groupsWithCounts: DbCommunityGroupWithCount[] = [];

  for (const group of groups || []) {
    const { count } = await supabase
      .from('community_group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', group.id);

    groupsWithCounts.push({
      ...group,
      member_count: count || 0,
    });
  }

  return groupsWithCounts;
}

/**
 * Get groups the current user belongs to (for a specific community)
 */
export async function getUserGroupsInCommunity(
  communityId: string,
  userId: string
): Promise<DbCommunityGroup[]> {
  // First get profile ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!profile) return [];

  const { data, error } = await supabase
    .from('community_group_members')
    .select(`
      group:community_groups!inner(*)
    `)
    .eq('user_id', profile.id);

  if (error) {
    console.error('Error fetching user groups:', error);
    return [];
  }

  // Filter to only groups in the specified community
  return (data || [])
    .map((d: any) => d.group as DbCommunityGroup)
    .filter((g) => g.community_id === communityId);
}

/**
 * Create a new group
 */
export async function createGroup(
  communityId: string,
  name: string,
  description?: string
): Promise<DbCommunityGroup | null> {
  // Get max position
  const { data: existing } = await supabase
    .from('community_groups')
    .select('position')
    .eq('community_id', communityId)
    .order('position', { ascending: false })
    .limit(1);

  const nextPosition = existing && existing.length > 0
    ? existing[0].position + 1
    : 0;

  const { data, error } = await supabase
    .from('community_groups')
    .insert({
      community_id: communityId,
      name,
      description: description || null,
      position: nextPosition,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating group:', error);
    return null;
  }

  return data;
}

/**
 * Update a group
 */
export async function updateGroup(
  groupId: string,
  updates: { name?: string; description?: string | null }
): Promise<DbCommunityGroup | null> {
  const { data, error } = await supabase
    .from('community_groups')
    .update(updates)
    .eq('id', groupId)
    .select()
    .single();

  if (error) {
    console.error('Error updating group:', error);
    return null;
  }

  return data;
}

/**
 * Delete a group (channels/events become global via ON DELETE SET NULL)
 */
export async function deleteGroup(groupId: string): Promise<boolean> {
  const { error } = await supabase
    .from('community_groups')
    .delete()
    .eq('id', groupId);

  if (error) {
    console.error('Error deleting group:', error);
    return false;
  }

  return true;
}

/**
 * Reorder groups
 */
export async function reorderGroups(groupIds: string[]): Promise<boolean> {
  const updates = groupIds.map((id, index) =>
    supabase
      .from('community_groups')
      .update({ position: index })
      .eq('id', id)
  );

  const results = await Promise.all(updates);
  return !results.some((r) => r.error);
}

// ============================================================================
// GROUP MEMBERS
// ============================================================================

/**
 * Get all members of a group
 */
export async function getGroupMembers(groupId: string): Promise<DbProfile[]> {
  const { data, error } = await supabase
    .from('community_group_members')
    .select(`
      profile:profiles!user_id(*)
    `)
    .eq('group_id', groupId);

  if (error) {
    console.error('Error fetching group members:', error);
    return [];
  }

  return (data || []).map((d: any) => d.profile as DbProfile);
}

/**
 * Get all community members with their group assignments
 * Returns members with a `groups` array of group IDs they belong to
 */
export async function getCommunityMembersWithGroups(
  communityId: string
): Promise<(DbProfile & { group_ids: string[] })[]> {
  // Get all community members
  const { data: memberships, error: membershipError } = await supabase
    .from('memberships')
    .select(`
      user_id,
      profile:profiles!user_id(*)
    `)
    .eq('community_id', communityId);

  if (membershipError) {
    console.error('Error fetching memberships:', membershipError);
    return [];
  }

  // Get all group memberships for these users
  const userIds = (memberships || []).map((m: any) => m.user_id);

  const { data: groupMemberships } = await supabase
    .from('community_group_members')
    .select('user_id, group_id')
    .in('user_id', userIds);

  // Build user -> group_ids map
  const userGroupsMap = new Map<string, string[]>();
  for (const gm of groupMemberships || []) {
    const existing = userGroupsMap.get(gm.user_id) || [];
    existing.push(gm.group_id);
    userGroupsMap.set(gm.user_id, existing);
  }

  return (memberships || []).map((m: any) => ({
    ...(m.profile as DbProfile),
    group_ids: userGroupsMap.get(m.user_id) || [],
  }));
}

/**
 * Add a member to a group
 */
export async function addMemberToGroup(
  groupId: string,
  userId: string,
  assignedBy: string
): Promise<boolean> {
  const { error } = await supabase
    .from('community_group_members')
    .insert({
      group_id: groupId,
      user_id: userId,
      assigned_by: assignedBy,
    });

  if (error) {
    // Ignore duplicate errors (already member)
    if (error.code === '23505') return true;
    console.error('Error adding member to group:', error);
    return false;
  }

  return true;
}

/**
 * Remove a member from a group
 */
export async function removeMemberFromGroup(
  groupId: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('community_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error removing member from group:', error);
    return false;
  }

  return true;
}

/**
 * Set group members (replaces all existing members)
 */
export async function setGroupMembers(
  groupId: string,
  userIds: string[],
  assignedBy: string
): Promise<boolean> {
  // Delete all existing members
  const { error: deleteError } = await supabase
    .from('community_group_members')
    .delete()
    .eq('group_id', groupId);

  if (deleteError) {
    console.error('Error clearing group members:', deleteError);
    return false;
  }

  // Insert new members
  if (userIds.length > 0) {
    const { error: insertError } = await supabase
      .from('community_group_members')
      .insert(
        userIds.map((userId) => ({
          group_id: groupId,
          user_id: userId,
          assigned_by: assignedBy,
        }))
      );

    if (insertError) {
      console.error('Error adding group members:', insertError);
      return false;
    }
  }

  return true;
}

// ============================================================================
// CHANNEL GROUP ASSIGNMENT
// ============================================================================

/**
 * Set a channel's group (null = global)
 */
export async function setChannelGroup(
  channelId: string,
  groupId: string | null
): Promise<boolean> {
  const { error } = await supabase
    .from('community_channels')
    .update({ group_id: groupId })
    .eq('id', channelId);

  if (error) {
    console.error('Error setting channel group:', error);
    return false;
  }

  return true;
}

// ============================================================================
// EVENT GROUP ASSIGNMENT
// ============================================================================

/**
 * Set an event's group (null = all members)
 */
export async function setEventGroup(
  eventId: string,
  groupId: string | null
): Promise<boolean> {
  const { error } = await supabase
    .from('events')
    .update({ group_id: groupId })
    .eq('id', eventId);

  if (error) {
    console.error('Error setting event group:', error);
    return false;
  }

  return true;
}
