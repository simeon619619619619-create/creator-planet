# Community Member Groups Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement member groups that allow creators to segment community members and control channel/event visibility.

**Architecture:** Two new tables (`community_groups`, `community_group_members`) with nullable `group_id` foreign key added to `community_channels` and `events`. RLS policies enforce visibility based on group membership. Service layer provides CRUD operations. UI shows Discord-style collapsible folder sections.

**Tech Stack:** PostgreSQL (Supabase), React, TypeScript, Tailwind CSS

---

## Phase 1: Database & Backend

### Task 1.1: Create Migration File

**Files:**
- Create: `supabase/migrations/017_community_groups.sql`

**Step 1: Write the migration SQL**

```sql
-- ============================================================================
-- COMMUNITY MEMBER GROUPS
-- Allows creators to segment community members into groups with channel/event access control
-- ============================================================================

-- ============================================================================
-- SECTION 1: CREATE NEW TABLES
-- ============================================================================

-- Community Groups (e.g., "Sofia", "VIP Members")
CREATE TABLE public.community_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT community_groups_name_unique UNIQUE(community_id, name)
);

CREATE INDEX community_groups_community_id_idx ON public.community_groups(community_id);
CREATE INDEX community_groups_position_idx ON public.community_groups(community_id, position);

COMMENT ON TABLE public.community_groups IS 'Member groups within communities for segmented access control';
COMMENT ON COLUMN public.community_groups.position IS 'Display order in sidebar (lower = higher)';

-- Group Memberships (which users belong to which groups)
CREATE TABLE public.community_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  assigned_by UUID REFERENCES public.profiles(id),

  CONSTRAINT group_member_unique UNIQUE(group_id, user_id)
);

CREATE INDEX community_group_members_group_id_idx ON public.community_group_members(group_id);
CREATE INDEX community_group_members_user_id_idx ON public.community_group_members(user_id);

COMMENT ON TABLE public.community_group_members IS 'Many-to-many relationship between groups and members';
COMMENT ON COLUMN public.community_group_members.assigned_by IS 'Profile ID of creator who assigned this member';

-- ============================================================================
-- SECTION 2: MODIFY EXISTING TABLES
-- ============================================================================

-- Add group_id to channels (NULL = global/visible to all)
ALTER TABLE public.community_channels
ADD COLUMN group_id UUID REFERENCES public.community_groups(id) ON DELETE SET NULL;

CREATE INDEX community_channels_group_id_idx ON public.community_channels(group_id);

COMMENT ON COLUMN public.community_channels.group_id IS 'NULL = global channel, set = group-restricted';

-- Add group_id to events (NULL = visible to all community members)
ALTER TABLE public.events
ADD COLUMN group_id UUID REFERENCES public.community_groups(id) ON DELETE SET NULL;

CREATE INDEX events_group_id_idx ON public.events(group_id);

COMMENT ON COLUMN public.events.group_id IS 'NULL = all members see event, set = group-restricted';

-- ============================================================================
-- SECTION 3: HELPER FUNCTIONS
-- ============================================================================

-- Check if a user is a member of a specific group
CREATE OR REPLACE FUNCTION is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.community_group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can see a channel (global or member of its group)
CREATE OR REPLACE FUNCTION can_view_channel(p_channel_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_group_id UUID;
BEGIN
  SELECT group_id INTO v_group_id
  FROM public.community_channels
  WHERE id = p_channel_id;

  -- Global channel (no group restriction)
  IF v_group_id IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Check group membership
  RETURN is_group_member(v_group_id, p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can see an event (no group or member of its group)
CREATE OR REPLACE FUNCTION can_view_event(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_group_id UUID;
BEGIN
  SELECT group_id INTO v_group_id
  FROM public.events
  WHERE id = p_event_id;

  -- Event visible to all (no group restriction)
  IF v_group_id IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Check group membership
  RETURN is_group_member(v_group_id, p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's profile ID from auth (helper for RLS)
CREATE OR REPLACE FUNCTION get_my_profile_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id FROM public.profiles
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is community owner
CREATE OR REPLACE FUNCTION is_community_owner(p_community_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.communities
    WHERE id = p_community_id AND creator_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 4: ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.community_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_group_members ENABLE ROW LEVEL SECURITY;

-- community_groups policies

-- Creators can manage their community's groups
CREATE POLICY "Creators can manage their community groups"
  ON public.community_groups
  FOR ALL
  USING (
    is_community_owner(community_id, get_my_profile_id())
  )
  WITH CHECK (
    is_community_owner(community_id, get_my_profile_id())
  );

-- Members can see groups they belong to
CREATE POLICY "Members can view groups they belong to"
  ON public.community_groups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.community_group_members cgm
      WHERE cgm.group_id = community_groups.id
      AND cgm.user_id = get_my_profile_id()
    )
  );

-- community_group_members policies

-- Creators can manage group memberships in their communities
CREATE POLICY "Creators can manage group memberships"
  ON public.community_group_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.community_groups cg
      JOIN public.communities c ON c.id = cg.community_id
      WHERE cg.id = community_group_members.group_id
      AND c.creator_id = get_my_profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.community_groups cg
      JOIN public.communities c ON c.id = cg.community_id
      WHERE cg.id = community_group_members.group_id
      AND c.creator_id = get_my_profile_id()
    )
  );

-- Users can see their own group memberships
CREATE POLICY "Users can view their own group memberships"
  ON public.community_group_members
  FOR SELECT
  USING (user_id = get_my_profile_id());

-- ============================================================================
-- SECTION 5: UPDATE EXISTING RLS POLICIES FOR CHANNELS
-- ============================================================================

-- Drop existing channel SELECT policy and recreate with group filtering
-- Note: Keep existing policies, add group-aware versions

-- Members can view channels (with group filtering)
DROP POLICY IF EXISTS "Members can view channels" ON public.community_channels;

CREATE POLICY "Members can view accessible channels"
  ON public.community_channels
  FOR SELECT
  USING (
    -- Must be community member
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.community_id = community_channels.community_id
      AND m.user_id = get_my_profile_id()
    )
    AND (
      -- Global channel (no group restriction)
      group_id IS NULL
      OR
      -- Member of the group
      is_group_member(group_id, get_my_profile_id())
      OR
      -- Community owner sees all
      is_community_owner(community_id, get_my_profile_id())
    )
  );
```

**Step 2: Apply migration via MCP**

Use `mcp__supabase__apply_migration` with name `community_groups` and the SQL above.

**Step 3: Verify migration**

Use `mcp__supabase__list_tables` to confirm new tables exist.

**Step 4: Commit**

```bash
git add supabase/migrations/017_community_groups.sql
git commit -m "feat(db): add community groups tables and RLS policies"
```

---

## Phase 2: Service Layer

### Task 2.1: Add TypeScript Types

**Files:**
- Modify: `src/core/supabase/database.types.ts`

**Step 1: Add new types at end of file**

Add after the quiz system types section (around line 765):

```typescript
// ============================================================================
// COMMUNITY GROUPS TYPES
// ============================================================================

// Community Groups
export interface DbCommunityGroup {
  id: string;
  community_id: string;
  name: string;
  description: string | null;
  position: number;
  created_at: string;
}

// Group Members
export interface DbCommunityGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  assigned_at: string;
  assigned_by: string | null;
}

// Group with member count (for UI)
export interface DbCommunityGroupWithCount extends DbCommunityGroup {
  member_count: number;
}

// Group with members list (for assignment UI)
export interface DbCommunityGroupWithMembers extends DbCommunityGroup {
  members: DbProfile[];
}

// Extended channel type with group info
export interface DbCommunityChannelWithGroup extends DbCommunityChannel {
  group_id: string | null;
  group?: DbCommunityGroup | null;
}

// Extended event type with group info
export interface DbEventWithGroup extends DbEvent {
  group_id: string | null;
  group?: DbCommunityGroup | null;
}

// Channels organized by group (for sidebar)
export interface ChannelsByGroup {
  global: DbCommunityChannel[];
  groups: {
    group: DbCommunityGroup;
    channels: DbCommunityChannel[];
  }[];
}
```

**Step 2: Commit**

```bash
git add src/core/supabase/database.types.ts
git commit -m "feat(types): add community groups TypeScript types"
```

---

### Task 2.2: Create Group Service

**Files:**
- Create: `src/features/community/groupService.ts`

**Step 1: Create the service file**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/features/community/groupService.ts
git commit -m "feat(service): add groupService for community groups CRUD"
```

---

### Task 2.3: Update Community Service for Group-Filtered Channels

**Files:**
- Modify: `src/features/community/communityService.ts`

**Step 1: Add import for new types**

At the top of the file, update imports:

```typescript
import {
  DbCommunity,
  DbCommunityChannel,
  DbCommunityChannelWithGroup,
  DbCommunityGroup,
  DbPost,
  DbPostWithAuthor,
  DbPostComment,
  DbPostCommentWithAuthor,
  DbMembership,
  MembershipRole,
  ChannelsByGroup,
} from '../../core/supabase/database.types';
```

**Step 2: Add function to get channels with group info**

Add after the existing `getChannels` function (around line 180):

```typescript
/**
 * Get channels with group info for a community
 * Includes group_id and group details
 */
export async function getChannelsWithGroups(
  communityId: string
): Promise<DbCommunityChannelWithGroup[]> {
  const { data, error } = await supabase
    .from('community_channels')
    .select(`
      *,
      group:community_groups(*)
    `)
    .eq('community_id', communityId)
    .order('position', { ascending: true });

  if (error) {
    console.error('Error fetching channels with groups:', error);
    return [];
  }

  return (data || []).map((ch: any) => ({
    ...ch,
    group: ch.group || null,
  }));
}

/**
 * Get channels organized by group for sidebar display
 * Returns global channels and group-specific channels
 */
export async function getChannelsByGroup(
  communityId: string,
  userGroupIds: string[]
): Promise<ChannelsByGroup> {
  const channels = await getChannelsWithGroups(communityId);

  const global: DbCommunityChannel[] = [];
  const groupsMap = new Map<string, { group: DbCommunityGroup; channels: DbCommunityChannel[] }>();

  for (const channel of channels) {
    if (!channel.group_id) {
      // Global channel
      global.push(channel);
    } else if (userGroupIds.includes(channel.group_id) && channel.group) {
      // Group-specific channel (user is member)
      const existing = groupsMap.get(channel.group_id);
      if (existing) {
        existing.channels.push(channel);
      } else {
        groupsMap.set(channel.group_id, {
          group: channel.group,
          channels: [channel],
        });
      }
    }
  }

  // Sort groups by position
  const groups = Array.from(groupsMap.values()).sort(
    (a, b) => a.group.position - b.group.position
  );

  return { global, groups };
}
```

**Step 3: Update createChannel to accept group_id**

Find the `createChannel` function and update signature:

```typescript
export async function createChannel(
  communityId: string,
  name: string,
  description?: string,
  position: number = 0,
  groupId?: string | null
): Promise<DbCommunityChannel | null> {
  const { data, error } = await supabase
    .from('community_channels')
    .insert({
      community_id: communityId,
      name,
      description,
      position,
      group_id: groupId || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating channel:', error);
    return null;
  }
  return data;
}
```

**Step 4: Update updateChannel to accept group_id**

Find the `updateChannel` function and update:

```typescript
export async function updateChannel(
  channelId: string,
  updates: { name?: string; description?: string; position?: number; group_id?: string | null }
): Promise<DbCommunityChannel | null> {
  const { data, error } = await supabase
    .from('community_channels')
    .update(updates)
    .eq('id', channelId)
    .select()
    .single();

  if (error) {
    console.error('Error updating channel:', error);
    return null;
  }
  return data;
}
```

**Step 5: Commit**

```bash
git add src/features/community/communityService.ts
git commit -m "feat(service): add group-aware channel functions"
```

---

### Task 2.4: Update Event Service for Group Filtering

**Files:**
- Modify: `src/features/calendar/eventService.ts`

**Step 1: Update createEvent to accept groupId**

Find the `createEvent` function and update signature:

```typescript
export async function createEvent(
  creatorId: string,
  title: string,
  startTime: Date,
  endTime: Date,
  eventType: EventType = 'group',
  description?: string,
  meetingLink?: string,
  maxAttendees?: number,
  communityId?: string,
  groupId?: string | null
): Promise<DbEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .insert({
      creator_id: creatorId,
      community_id: communityId,
      title,
      description,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      event_type: eventType,
      meeting_link: meetingLink,
      max_attendees: maxAttendees,
      group_id: groupId || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating event:', error);
    return null;
  }
  return data;
}
```

**Step 2: Update updateEvent to accept group_id**

Find the `updateEvent` function and update:

```typescript
export async function updateEvent(
  eventId: string,
  updates: Partial<{
    title: string;
    description: string;
    start_time: string;
    end_time: string;
    meeting_link: string;
    max_attendees: number;
    group_id: string | null;
  }>
): Promise<boolean> {
  const { error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', eventId);

  if (error) {
    console.error('Error updating event:', error);
    return false;
  }
  return true;
}
```

**Step 3: Add types import at top**

```typescript
import type { DbEventWithGroup } from '../../core/supabase/database.types';
```

**Step 4: Add function to get events with group info**

Add after getCreatorEvents:

```typescript
/**
 * Get creator events with group info
 */
export async function getCreatorEventsWithGroups(
  creatorId: string
): Promise<(EventWithDetails & { group_id: string | null; group?: any })[]> {
  const { data: events, error } = await supabase
    .from('events')
    .select(`
      *,
      group:community_groups(id, name)
    `)
    .eq('creator_id', creatorId)
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error fetching creator events:', error);
    return [];
  }

  const eventsWithDetails: (EventWithDetails & { group_id: string | null; group?: any })[] = [];

  for (const event of events || []) {
    const { count } = await supabase
      .from('event_attendees')
      .select('id', { count: 'exact' })
      .eq('event_id', event.id)
      .eq('status', 'attending');

    eventsWithDetails.push({
      ...event,
      attendee_count: count || 0,
      group: event.group || null,
    });
  }

  return eventsWithDetails;
}
```

**Step 5: Commit**

```bash
git add src/features/calendar/eventService.ts
git commit -m "feat(service): add group support to event service"
```

---

## Phase 3: Creator UI Components

### Task 3.1: Create GroupManager Component

**Files:**
- Create: `src/features/community/components/GroupManager.tsx`

**Step 1: Create the component**

```typescript
// ============================================================================
// GROUP MANAGER COMPONENT
// Allows creators to create, edit, delete, and reorder member groups
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Edit3,
  Trash2,
  GripVertical,
  Loader2,
  X,
  ChevronRight,
} from 'lucide-react';
import {
  getGroupsWithCounts,
  createGroup,
  updateGroup,
  deleteGroup,
} from '../groupService';
import type { DbCommunityGroupWithCount } from '../../../core/supabase/database.types';

interface GroupManagerProps {
  communityId: string;
  onSelectGroup: (groupId: string) => void;
  onClose: () => void;
}

const GroupManager: React.FC<GroupManagerProps> = ({
  communityId,
  onSelectGroup,
  onClose,
}) => {
  const [groups, setGroups] = useState<DbCommunityGroupWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<DbCommunityGroupWithCount | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadGroups();
  }, [communityId]);

  const loadGroups = async () => {
    setIsLoading(true);
    const data = await getGroupsWithCounts(communityId);
    setGroups(data);
    setIsLoading(false);
  };

  const handleAddGroup = async () => {
    if (!newGroupName.trim() || isSaving) return;

    setIsSaving(true);
    const result = await createGroup(
      communityId,
      newGroupName.trim(),
      newGroupDescription.trim() || undefined
    );

    if (result) {
      setNewGroupName('');
      setNewGroupDescription('');
      setShowAddForm(false);
      await loadGroups();
    }
    setIsSaving(false);
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup || !newGroupName.trim() || isSaving) return;

    setIsSaving(true);
    const result = await updateGroup(editingGroup.id, {
      name: newGroupName.trim(),
      description: newGroupDescription.trim() || null,
    });

    if (result) {
      setEditingGroup(null);
      setNewGroupName('');
      setNewGroupDescription('');
      await loadGroups();
    }
    setIsSaving(false);
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Delete this group? Channels and events in this group will become visible to all members.')) {
      return;
    }

    const success = await deleteGroup(groupId);
    if (success) {
      await loadGroups();
    }
  };

  const startEdit = (group: DbCommunityGroupWithCount) => {
    setEditingGroup(group);
    setNewGroupName(group.name);
    setNewGroupDescription(group.description || '');
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingGroup(null);
    setNewGroupName('');
    setNewGroupDescription('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Member Groups</h3>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-600"
        >
          <X size={20} />
        </button>
      </div>

      <p className="text-sm text-slate-500">
        Create groups to segment your community. Assign channels and events to specific groups.
      </p>

      {/* Groups List */}
      <div className="space-y-2">
        {groups.map((group) => (
          <div
            key={group.id}
            className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg group"
          >
            <GripVertical size={16} className="text-slate-300 cursor-grab" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">{group.name}</span>
                <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                  {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                </span>
              </div>
              {group.description && (
                <p className="text-sm text-slate-500 truncate">{group.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onSelectGroup(group.id)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                title="Manage members"
              >
                <Users size={16} />
              </button>
              <button
                onClick={() => startEdit(group)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                title="Edit group"
              >
                <Edit3 size={16} />
              </button>
              <button
                onClick={() => handleDeleteGroup(group.id)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                title="Delete group"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </div>
        ))}

        {groups.length === 0 && !showAddForm && (
          <p className="text-sm text-slate-500 text-center py-4">
            No groups yet. Create your first group to start segmenting your community.
          </p>
        )}
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingGroup) && (
        <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100 space-y-3">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Group name (e.g., Sofia, VIP Members)"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            autoFocus
          />
          <input
            type="text"
            value={newGroupDescription}
            onChange={(e) => setNewGroupDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <div className="flex gap-2">
            <button
              onClick={editingGroup ? handleUpdateGroup : handleAddGroup}
              disabled={!newGroupName.trim() || isSaving}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin mx-auto" />
              ) : editingGroup ? (
                'Save Changes'
              ) : (
                'Create Group'
              )}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                cancelEdit();
              }}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add Button */}
      {!showAddForm && !editingGroup && (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full py-2 px-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-indigo-400 hover:text-indigo-600 flex items-center justify-center gap-2 transition-colors"
        >
          <Plus size={18} />
          Add Group
        </button>
      )}
    </div>
  );
};

export default GroupManager;
```

**Step 2: Commit**

```bash
git add src/features/community/components/GroupManager.tsx
git commit -m "feat(ui): add GroupManager component for creating/editing groups"
```

---

### Task 3.2: Create GroupMemberAssigner Component

**Files:**
- Create: `src/features/community/components/GroupMemberAssigner.tsx`

**Step 1: Create the component**

```typescript
// ============================================================================
// GROUP MEMBER ASSIGNER COMPONENT
// Allows creators to assign/remove members from a specific group
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Search,
  Check,
  Loader2,
  Users,
} from 'lucide-react';
import {
  getCommunityMembersWithGroups,
  setGroupMembers,
  getGroupsWithCounts,
} from '../groupService';
import type { DbProfile, DbCommunityGroup } from '../../../core/supabase/database.types';
import { useAuth } from '../../../core/contexts/AuthContext';

interface GroupMemberAssignerProps {
  communityId: string;
  groupId: string;
  onBack: () => void;
}

interface MemberWithGroups extends DbProfile {
  group_ids: string[];
}

const GroupMemberAssigner: React.FC<GroupMemberAssignerProps> = ({
  communityId,
  groupId,
  onBack,
}) => {
  const { profile } = useAuth();
  const [group, setGroup] = useState<DbCommunityGroup | null>(null);
  const [members, setMembers] = useState<MemberWithGroups[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadData();
  }, [communityId, groupId]);

  const loadData = async () => {
    setIsLoading(true);

    // Load group info
    const groups = await getGroupsWithCounts(communityId);
    const currentGroup = groups.find((g) => g.id === groupId);
    setGroup(currentGroup || null);

    // Load all community members with their group assignments
    const allMembers = await getCommunityMembersWithGroups(communityId);
    setMembers(allMembers);

    // Pre-select members already in this group
    const initialSelected = new Set(
      allMembers
        .filter((m) => m.group_ids.includes(groupId))
        .map((m) => m.id)
    );
    setSelectedIds(initialSelected);

    setIsLoading(false);
  };

  const toggleMember = (memberId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedIds(newSelected);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!profile?.id || isSaving) return;

    setIsSaving(true);
    const success = await setGroupMembers(
      groupId,
      Array.from(selectedIds),
      profile.id
    );

    if (success) {
      setHasChanges(false);
      onBack();
    }
    setIsSaving(false);
  };

  const filteredMembers = members.filter((m) =>
    (m.full_name || m.email || '')
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {group?.name || 'Group'} Members
          </h3>
          <p className="text-sm text-slate-500">
            {selectedIds.size} member{selectedIds.size !== 1 ? 's' : ''} selected
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search members..."
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Members List */}
      <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
        {filteredMembers.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-500">
            {searchQuery ? 'No members match your search' : 'No members in this community yet'}
          </div>
        ) : (
          filteredMembers.map((member) => (
            <label
              key={member.id}
              className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(member.id)}
                onChange={() => toggleMember(member.id)}
                className="sr-only"
              />
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  selectedIds.has(member.id)
                    ? 'bg-indigo-600 border-indigo-600'
                    : 'border-slate-300'
                }`}
              >
                {selectedIds.has(member.id) && (
                  <Check size={14} className="text-white" />
                )}
              </div>
              <img
                src={
                  member.avatar_url ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    member.full_name || 'User'
                  )}&background=6366f1&color=fff`
                }
                alt={member.full_name || 'User'}
                className="w-8 h-8 rounded-full object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">
                  {member.full_name || 'Unknown'}
                </p>
                <p className="text-xs text-slate-500 truncate">{member.email}</p>
              </div>
              {member.group_ids.length > 0 && (
                <span className="text-xs text-slate-400">
                  {member.group_ids.length} group{member.group_ids.length !== 1 ? 's' : ''}
                </span>
              )}
            </label>
          ))
        )}
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={!hasChanges || isSaving}
        className="w-full py-2.5 px-4 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isSaving ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Users size={16} />
            Save Members
          </>
        )}
      </button>
    </div>
  );
};

export default GroupMemberAssigner;
```

**Step 2: Commit**

```bash
git add src/features/community/components/GroupMemberAssigner.tsx
git commit -m "feat(ui): add GroupMemberAssigner component for member assignment"
```

---

### Task 3.3: Create GroupFolderSection Component

**Files:**
- Create: `src/features/community/components/GroupFolderSection.tsx`

**Step 1: Create the component**

```typescript
// ============================================================================
// GROUP FOLDER SECTION COMPONENT
// Collapsible folder in sidebar showing channels for a group
// ============================================================================

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Edit3,
  Trash2,
  Plus,
} from 'lucide-react';
import type {
  DbCommunityChannel,
  DbCommunityGroup,
} from '../../../core/supabase/database.types';

interface GroupFolderSectionProps {
  group?: DbCommunityGroup; // undefined = global section
  channels: DbCommunityChannel[];
  selectedChannelId: string | null;
  isOwner: boolean;
  memberCount?: number;
  onSelectChannel: (channel: DbCommunityChannel) => void;
  onEditChannel: (channel: DbCommunityChannel) => void;
  onDeleteChannel: (channelId: string) => void;
  onAddChannel?: () => void;
}

const GroupFolderSection: React.FC<GroupFolderSectionProps> = ({
  group,
  channels,
  selectedChannelId,
  isOwner,
  memberCount,
  onSelectChannel,
  onEditChannel,
  onDeleteChannel,
  onAddChannel,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showChannelMenu, setShowChannelMenu] = useState<string | null>(null);

  const sectionName = group?.name || 'GENERAL';
  const isGlobal = !group;

  return (
    <div className="mb-2">
      {/* Section Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 uppercase tracking-wider"
      >
        {isExpanded ? (
          <ChevronDown size={14} />
        ) : (
          <ChevronRight size={14} />
        )}
        <span className="flex-1 text-left">{sectionName}</span>
        {memberCount !== undefined && !isGlobal && (
          <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-normal normal-case">
            {memberCount}
          </span>
        )}
        {isOwner && onAddChannel && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onAddChannel();
            }}
            className="p-0.5 hover:bg-slate-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Plus size={12} />
          </span>
        )}
      </button>

      {/* Channels */}
      {isExpanded && (
        <div className="space-y-0.5 mt-0.5">
          {channels.map((channel) => (
            <div
              key={channel.id}
              className={`group relative flex items-center rounded-lg transition-colors
                ${selectedChannelId === channel.id ? 'bg-indigo-50' : 'hover:bg-slate-50'}
              `}
            >
              <button
                onClick={() => onSelectChannel(channel)}
                className={`flex-1 text-left px-3 py-1.5 text-sm font-medium transition-colors
                  ${selectedChannelId === channel.id ? 'text-indigo-700' : 'text-slate-600'}
                `}
              >
                # {channel.name.toLowerCase().replace(/ /g, '-')}
              </button>
              {isOwner && (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowChannelMenu(
                        showChannelMenu === channel.id ? null : channel.id
                      );
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 transition-all"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {showChannelMenu === channel.id && (
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20 min-w-[100px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowChannelMenu(null);
                          onEditChannel(channel);
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Edit3 size={12} />
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowChannelMenu(null);
                          onDeleteChannel(channel.id);
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {channels.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-400 italic">
              No channels
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default GroupFolderSection;
```

**Step 2: Commit**

```bash
git add src/features/community/components/GroupFolderSection.tsx
git commit -m "feat(ui): add GroupFolderSection collapsible sidebar component"
```

---

## Phase 4: Integration

### Task 4.1: Create Index Export for Community Components

**Files:**
- Create: `src/features/community/components/index.ts`

**Step 1: Create the index file**

```typescript
export { default as GroupManager } from './GroupManager';
export { default as GroupMemberAssigner } from './GroupMemberAssigner';
export { default as GroupFolderSection } from './GroupFolderSection';
export { default as CommunityPricingSettings } from './CommunityPricingSettings';
```

**Step 2: Commit**

```bash
git add src/features/community/components/index.ts
git commit -m "feat: add index export for community components"
```

---

### Task 4.2: Update CommunityHub Sidebar with Group Folders

**Files:**
- Modify: `src/features/community/CommunityHub.tsx`

This is the largest change. The sidebar needs to be refactored to show collapsible group folders.

**Step 1: Add imports at top of file**

```typescript
import { GroupFolderSection, GroupManager, GroupMemberAssigner } from './components';
import { getChannelsByGroup, getChannelsWithGroups } from './communityService';
import { getGroupsWithCounts, getUserGroupsInCommunity } from './groupService';
import type { ChannelsByGroup, DbCommunityGroupWithCount } from '../../core/supabase/database.types';
```

**Step 2: Add state variables after existing useState declarations (around line 50)**

```typescript
// Group management state
const [channelsByGroup, setChannelsByGroup] = useState<ChannelsByGroup | null>(null);
const [userGroupIds, setUserGroupIds] = useState<string[]>([]);
const [groups, setGroups] = useState<DbCommunityGroupWithCount[]>([]);
const [showGroupManager, setShowGroupManager] = useState(false);
const [selectedGroupForAssign, setSelectedGroupForAssign] = useState<string | null>(null);
```

**Step 3: Add loadChannelsByGroup function after existing load functions**

```typescript
const loadChannelsByGroup = async () => {
  if (!selectedCommunity || !user?.id) return;

  // Get user's groups in this community
  const userGroups = await getUserGroupsInCommunity(selectedCommunity.id, user.id);
  const groupIds = userGroups.map((g) => g.id);
  setUserGroupIds(groupIds);

  // Get channels organized by group
  const organized = await getChannelsByGroup(selectedCommunity.id, groupIds);
  setChannelsByGroup(organized);

  // For owners, load all groups with counts
  if (isOwner) {
    const allGroups = await getGroupsWithCounts(selectedCommunity.id);
    setGroups(allGroups);
  }

  // Auto-select first channel if none selected
  if (!selectedChannel) {
    if (organized.global.length > 0) {
      setSelectedChannel(organized.global[0]);
    } else if (organized.groups.length > 0 && organized.groups[0].channels.length > 0) {
      setSelectedChannel(organized.groups[0].channels[0]);
    }
  }
};
```

**Step 4: Update useEffect for loading channels to use new function**

Find the useEffect that loads channels and update it to call `loadChannelsByGroup()` instead of `getChannels()`.

**Step 5: Replace the channels list in sidebar (around lines 647-702) with GroupFolderSection components**

```typescript
{/* Channel Folders */}
{channelsByGroup && (
  <div className="space-y-1">
    {/* Global Section */}
    <GroupFolderSection
      channels={channelsByGroup.global}
      selectedChannelId={selectedChannel?.id || null}
      isOwner={isOwner}
      onSelectChannel={setSelectedChannel}
      onEditChannel={handleOpenChannelModal}
      onDeleteChannel={handleDeleteChannel}
      onAddChannel={() => handleOpenChannelModal()}
    />

    {/* Group Sections */}
    {channelsByGroup.groups.map(({ group, channels: groupChannels }) => (
      <GroupFolderSection
        key={group.id}
        group={group}
        channels={groupChannels}
        selectedChannelId={selectedChannel?.id || null}
        isOwner={isOwner}
        memberCount={groups.find((g) => g.id === group.id)?.member_count}
        onSelectChannel={setSelectedChannel}
        onEditChannel={handleOpenChannelModal}
        onDeleteChannel={handleDeleteChannel}
      />
    ))}
  </div>
)}

{/* Manage Groups button (owner only) */}
{isOwner && (
  <button
    onClick={() => setShowGroupManager(true)}
    className="w-full mt-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-2"
  >
    <Users size={16} />
    Manage Groups
  </button>
)}
```

**Step 6: Add Group Manager modal at end of component (before final closing div)**

```typescript
{/* Group Manager Modal */}
{showGroupManager && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6 max-h-[80vh] overflow-y-auto">
      {selectedGroupForAssign ? (
        <GroupMemberAssigner
          communityId={selectedCommunity!.id}
          groupId={selectedGroupForAssign}
          onBack={() => setSelectedGroupForAssign(null)}
        />
      ) : (
        <GroupManager
          communityId={selectedCommunity!.id}
          onSelectGroup={setSelectedGroupForAssign}
          onClose={() => {
            setShowGroupManager(false);
            loadChannelsByGroup(); // Refresh after changes
          }}
        />
      )}
    </div>
  </div>
)}
```

**Step 7: Commit**

```bash
git add src/features/community/CommunityHub.tsx
git commit -m "feat(ui): integrate group folders into CommunityHub sidebar"
```

---

### Task 4.3: Update Channel Edit Modal with Group Selector

**Files:**
- Modify the channel modal in `CommunityHub.tsx`

Find the channel modal and add a group selector dropdown.

**Step 1: Add state for channel group**

```typescript
const [channelGroupId, setChannelGroupId] = useState<string | null>(null);
```

**Step 2: In the channel modal, add group selector after description input**

```typescript
{/* Group Selector */}
{isOwner && groups.length > 0 && (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">
      Visible to
    </label>
    <select
      value={channelGroupId || ''}
      onChange={(e) => setChannelGroupId(e.target.value || null)}
      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
    >
      <option value="">All Members (Global)</option>
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name} ({g.member_count} members)
        </option>
      ))}
    </select>
    <p className="mt-1 text-xs text-slate-500">
      Choose which group can see this channel
    </p>
  </div>
)}
```

**Step 3: Update handleChannelSave to include group_id**

```typescript
// In the save handler, pass group_id
if (editingChannel) {
  const updated = await updateChannel(editingChannel.id, {
    name: channelName,
    description: channelDescription,
    group_id: channelGroupId,
  });
  // ...
} else {
  const newCh = await createChannel(
    selectedCommunity!.id,
    channelName,
    channelDescription,
    channels.length,
    channelGroupId
  );
  // ...
}
```

**Step 4: Commit**

```bash
git add src/features/community/CommunityHub.tsx
git commit -m "feat(ui): add group selector to channel edit modal"
```

---

### Task 4.4: Final Integration Test

**Step 1: Run the development server**

```bash
npm run dev
```

**Step 2: Test the following flows**

1. Creator creates a new group ("Sofia")
2. Creator assigns members to the group
3. Creator creates a channel assigned to "Sofia" group
4. Non-Sofia members cannot see the channel
5. Sofia members can see and post in the channel
6. Deleting group makes channels global again

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete community member groups implementation

- Add community_groups and community_group_members tables
- Add group_id to channels and events
- Create GroupManager, GroupMemberAssigner, GroupFolderSection components
- Integrate Discord-style collapsible folders in sidebar
- RLS policies enforce group-based visibility"
```

---

## Summary

| Phase | Tasks | Files Changed |
|-------|-------|---------------|
| 1. Database | Migration, RLS, helpers | `017_community_groups.sql` |
| 2. Services | Types, groupService, updates | `database.types.ts`, `groupService.ts`, `communityService.ts`, `eventService.ts` |
| 3. Components | GroupManager, GroupMemberAssigner, GroupFolderSection | 3 new component files |
| 4. Integration | CommunityHub sidebar, channel modal | `CommunityHub.tsx` |

**Total estimated commits:** 10
**Key dependencies:** None (all new code)
