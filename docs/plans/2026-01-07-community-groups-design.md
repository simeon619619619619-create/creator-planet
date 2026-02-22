# Community Member Groups Design

**Date:** 2026-01-07
**Status:** Approved
**Feature:** Sub-segmentation of community members with group-based channel and event visibility

## Overview

Creators can create member groups (e.g., "Sofia", "Varna", "VIP") to segment their community. Channels and events can be restricted to specific groups, allowing creators to organize content and meetings for subsets of their members.

## User Stories

- As a creator, I want to create member groups so I can organize my community by location, tier, or interest
- As a creator, I want to assign members to groups so they see relevant content
- As a creator, I want to restrict certain channels to specific groups
- As a creator, I want to create events visible only to certain groups (e.g., "Sofia Meetup")
- As a member, I want to see channels and events relevant to my groups

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Member assignment | Creator manually assigns | Full creator control over segmentation |
| Multiple groups | Yes, members can be in multiple | Flexibility (e.g., "Sofia" + "VIP") |
| New member default | Global channels only | Safe default until creator assigns |
| UI organization | Discord-style collapsible folders | Familiar, scalable pattern |
| Global section | Always required | Ensures all members have base access |
| Event integration | Same group system | Consistent, simple model |

## Data Model

### New Tables

#### `community_groups`
```sql
CREATE TABLE public.community_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT community_groups_name_unique UNIQUE(community_id, name)
);
```

#### `community_group_members`
```sql
CREATE TABLE public.community_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID REFERENCES public.profiles(id),

  CONSTRAINT group_member_unique UNIQUE(group_id, user_id)
);
```

### Modified Tables

#### `community_channels` - Add column
```sql
ALTER TABLE public.community_channels
ADD COLUMN group_id UUID REFERENCES public.community_groups(id) ON DELETE SET NULL;

-- NULL = global channel (visible to all members)
-- Set = restricted to group members only
```

#### `events` - Add column
```sql
ALTER TABLE public.events
ADD COLUMN group_id UUID REFERENCES public.community_groups(id) ON DELETE SET NULL;

-- NULL = visible to all community members
-- Set = restricted to group members only
```

## Access Control

### Visibility Rules

**Channel visibility:**
```
User sees channel IF:
  channel.group_id IS NULL (global)
  OR user exists in community_group_members for that group_id
```

**Event visibility:**
```
User sees event IF:
  event.group_id IS NULL (all members)
  OR user exists in community_group_members for that group_id
```

### Helper Function

```sql
CREATE OR REPLACE FUNCTION is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.community_group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### RLS Policies

#### community_groups
- SELECT: Members can see groups they belong to; creators see all groups in their communities
- INSERT/UPDATE/DELETE: Only community creator/admin

#### community_group_members
- SELECT: Creators see all; members can see their own membership
- INSERT/DELETE: Only community creator/admin

#### community_channels (modified)
- SELECT: Add condition `group_id IS NULL OR is_group_member(group_id, get_my_profile_id())`

#### events (modified)
- SELECT: Add condition for community events `group_id IS NULL OR is_group_member(group_id, get_my_profile_id())`

## UI Design

### Sidebar Structure (CommunityHub.tsx)

```
▼ GENERAL                    ← Always first, always visible to all
  # announcements
  # wins
  # help-needed

▼ SOFIA                      ← Only visible to Sofia group members
  # meetups                    Creator sees member count badge
  # local-chat

▼ VIP MEMBERS                ← Only visible to VIP group members
  # exclusive-content
```

### Components

#### New Components

| Component | Purpose |
|-----------|---------|
| `GroupManager.tsx` | Create/edit/delete groups, reorder |
| `GroupMemberAssigner.tsx` | Multi-select to assign members to groups |
| `GroupFolderSection.tsx` | Collapsible folder in sidebar |

#### Modified Components

| Component | Changes |
|-----------|---------|
| `CommunityHub.tsx` | Sidebar grouped by folders, group management UI |
| `ChannelEditModal.tsx` | Add group selector dropdown |
| `CalendarView.tsx` | Filter events by group, add group selector to event modal |
| `EventModal.tsx` | Add "Visible to" group dropdown |

### Creator Group Management Flow

1. Creator opens community settings or clicks "Manage Groups" in sidebar
2. Group Manager shows list of existing groups with member counts
3. Creator can add new group (name, description)
4. Creator clicks group to open Group Member Assigner
5. Assigner shows all community members with checkboxes
6. Creator selects/deselects members, saves

### Channel Group Assignment Flow

1. Creator creates/edits channel
2. Modal shows "Visible to" dropdown: "All Members" / [Group 1] / [Group 2]...
3. Selecting a group restricts channel to that group
4. Channel appears under that group's folder in sidebar

### Event Group Restriction Flow

1. Creator creates event
2. Modal shows "Visible to" dropdown (same as channels)
3. Selecting a group restricts event visibility
4. Only group members see event in calendar

## Implementation Phases

### Phase 1: Database & Backend
1. Create migration for `community_groups` table
2. Create migration for `community_group_members` table
3. Add `group_id` to `community_channels`
4. Add `group_id` to `events`
5. Create `is_group_member()` helper function
6. Add RLS policies for all tables

### Phase 2: Service Layer
1. Create `groupService.ts` with CRUD operations
2. Update `communityService.ts` - filter channels by group access
3. Update `eventService.ts` - filter events by group access
4. Add TypeScript types to `database.types.ts`

### Phase 3: Creator UI
1. Build `GroupManager.tsx` component
2. Build `GroupMemberAssigner.tsx` component
3. Update `ChannelEditModal.tsx` with group selector
4. Update event creation modal with group selector
5. Add group management entry point in CommunityHub

### Phase 4: Member-Facing UI
1. Refactor sidebar to use collapsible `GroupFolderSection` components
2. Filter displayed channels based on user's group memberships
3. Update CalendarView to filter events by group access

## TypeScript Types

```typescript
// New types
export interface DbCommunityGroup {
  id: string;
  community_id: string;
  name: string;
  description: string | null;
  position: number;
  created_at: string;
}

export interface DbCommunityGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  assigned_at: string;
  assigned_by: string | null;
}

// Extended types
export interface DbCommunityChannelWithGroup extends DbCommunityChannel {
  group_id: string | null;
  group?: DbCommunityGroup;
}

export interface DbEventWithGroup extends DbEvent {
  group_id: string | null;
  group?: DbCommunityGroup;
}

// UI types
export interface GroupWithMembers extends DbCommunityGroup {
  member_count: number;
  members?: DbProfile[];
}

export interface ChannelsByGroup {
  global: DbCommunityChannel[];
  groups: {
    group: DbCommunityGroup;
    channels: DbCommunityChannel[];
  }[];
}
```

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Group deleted | Channels/events in group become global (`ON DELETE SET NULL`) |
| Member removed from group | Loses access to group channels/events immediately |
| Member removed from community | Cascade deletes their group memberships |
| Empty group | Group still appears for creator, hidden for members (no channels) |
| All channels in groups | Global section shows "No channels" or is hidden |

## Future Considerations (Out of Scope)

- Member self-selection for groups (opt-in groups)
- Group-based notifications settings
- Group chat (separate from channels)
- Nested groups / group hierarchies
- Group-based pricing tiers
