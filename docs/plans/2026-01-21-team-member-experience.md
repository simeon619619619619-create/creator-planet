# Team Member Experience - Implementation Plan

## Overview

When a creator invites a lecturer, assistant, or guest expert, they should have a smooth, focused experience that only shows them the community they were invited to.

---

## Part 1: Invitation Link System

### 1.1 Database Changes

Add invitation token support to `community_team_members`:

```sql
ALTER TABLE community_team_members
ADD COLUMN invite_token TEXT UNIQUE,
ADD COLUMN invite_expires_at TIMESTAMPTZ,
ADD COLUMN invite_created_at TIMESTAMPTZ DEFAULT NOW();

-- Index for token lookups
CREATE INDEX idx_team_members_invite_token
ON community_team_members (invite_token)
WHERE invite_token IS NOT NULL;
```

### 1.2 Token Generation

When creator invites someone:
1. Generate cryptographically secure token: `crypto.randomUUID()` (32 chars)
2. Set expiration: `NOW() + INTERVAL '7 days'`
3. Store in `invite_token` and `invite_expires_at`

**Token format**: Simple UUID, e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

**Link format**: `https://creatorclub.bg/invite/team/{token}`

### 1.3 Invitation Flow

```
Creator fills form (email, role, title, bio, is_messageable)
           ↓
System creates pending team member record with token
           ↓
Creator sees modal with copyable link + "Copy Link" button
           ↓
Creator shares link via email/WhatsApp/etc
           ↓
Invitee clicks link
           ↓
  ┌─────────────────┴─────────────────┐
  │                                    │
Not logged in                    Logged in
  ↓                                    ↓
Show invite details              Validate token
  ↓                                    ↓
Signup/Login buttons             Accept invitation
  ↓                                    ↓
After auth, redirect             Link profile to invite
back to /invite/team/{token}     Set status = 'accepted'
  ↓                                    ↓
Accept invitation                Redirect to team dashboard
  ↓
Create membership if needed
  ↓
Redirect to team dashboard
```

### 1.4 Invite Page Component

**Route**: `/invite/team/:token`

**States**:
1. **Loading**: Validating token
2. **Invalid/Expired**: Show error with "Contact the creator" message
3. **Already Accepted**: Redirect to team dashboard
4. **Valid (Not logged in)**: Show invite card with signup/login
5. **Valid (Logged in)**: Show accept button

**Invite Card shows**:
- Community name + logo
- Role (Lecturer/Assistant/Guest Expert) with badge
- Title (if set by creator)
- Creator name
- "You've been invited to join as a [role]"

---

## Part 2: Team Member Detection & Mode

### 2.1 Auth Context Enhancement

Add team membership detection to `AuthContext`:

```typescript
interface AuthContextType {
  // ... existing
  teamMemberships: TeamMembershipInfo[] | null;
  isTeamMemberOnly: boolean;  // True if ONLY team member, no regular memberships
  primaryTeamCommunity: string | null;  // Community ID for team-only users
}

interface TeamMembershipInfo {
  communityId: string;
  communityName: string;
  role: TeamMemberRole;
  title: string | null;
  teamMemberId: string;
}
```

On login, fetch:
```typescript
// Check if user is a team member in any community
const { data: teamMemberships } = await supabase
  .from('community_team_members')
  .select('id, community_id, role, title, communities(name)')
  .eq('profile_id', profile.id)
  .eq('invite_status', 'accepted');

// Check regular memberships
const { data: regularMemberships } = await supabase
  .from('memberships')
  .select('id')
  .eq('user_id', profile.id);

// isTeamMemberOnly = has team memberships BUT no regular memberships as non-creator
const isTeamMemberOnly = teamMemberships?.length > 0 &&
  (regularMemberships?.length === 0 || allMembershipsAreFromTeamInvites);
```

### 2.2 Community Context Enhancement

For team-only users:
- Auto-select their team community (if only one)
- Hide community switcher (or show read-only badge)
- Block switching to other communities

```typescript
// In CommunityContext
if (isTeamMemberOnly && primaryTeamCommunity) {
  // Force-select the team community
  setSelectedCommunity(primaryTeamCommunity);
  // Disable switching
}
```

---

## Part 3: Team Member UI/UX

### 3.1 Sidebar for Team Members

**Show**:
- ✅ Dashboard (Team Dashboard - different content)
- ✅ Community (their community only)
- ✅ Courses (courses they're associated with)
- ✅ Calendar (community events)
- ✅ Messages (dedicated nav item → their DM inbox)
- ✅ Settings

**Hide**:
- ❌ AI Success Manager (creator only)
- ❌ Student Manager (creator only)
- ❌ Surveys (creator only)
- ❌ Discounts (creator only)
- ❌ Homework management (they see student homework, not manage it)

**Community Switcher**:
- Show their community name as header (non-interactive)
- OR show single community pill with role badge
- NO dropdown, NO "Browse More"

### 3.2 Team Dashboard

**New component**: `TeamDashboard.tsx`

**Layout**:
```
┌─────────────────────────────────────────────────────┐
│  Welcome back, [Name]!                              │
│  You're a [Lecturer] at [Community Name]            │
├───────────────────────┬─────────────────────────────┤
│                       │                             │
│   📬 Messages (3)     │   📚 Your Courses          │
│   ──────────────      │   ──────────────            │
│   [Recent messages]   │   [Courses they teach]      │
│   [View All →]        │                             │
│                       │                             │
├───────────────────────┼─────────────────────────────┤
│                       │                             │
│   📅 Upcoming Events  │   👤 Your Profile          │
│   ──────────────      │   ──────────────            │
│   [Next 3 events]     │   [Profile card]            │
│   [View Calendar →]   │   [Edit Profile →]          │
│                       │                             │
└───────────────────────┴─────────────────────────────┘
```

**Sections**:
1. **Messages Card**
   - Unread count badge
   - Last 3 conversations preview
   - "View All" → Messages page

2. **Your Courses Card** (for lecturers)
   - Courses where `creator_id = profile.id`
   - Quick "View Course" links
   - For assistants/guests: courses they're tagged in (future)

3. **Upcoming Events Card**
   - Next 3 community events
   - "View Calendar" link

4. **Your Profile Card**
   - Team member profile preview
   - Role badge
   - Title
   - "Edit Profile" → Team profile settings

### 3.3 Messages Page (Team Inbox)

**New route**: `/app/messages` (or `/messages`)

**New component**: `TeamInboxPage.tsx`

**Features**:
- Full inbox view (not just sidebar panel)
- List of all conversations
- Unread badges
- Search/filter
- Click to open conversation thread

This gives team members a dedicated place to access their DMs without needing to be in the Community view.

### 3.4 Team Profile Settings

In Settings, add "Team Profile" section for team members:
- Edit title
- Edit bio
- Toggle messageable (if allowed by creator)
- View which community they're a team member of

---

## Part 4: Navigation Constants Update

### 4.1 New Nav Items Array

```typescript
// constants.ts
export const TEAM_MEMBER_NAV_ITEMS = [
  { id: View.DASHBOARD, label: 'Dashboard', icon: 'LayoutDashboard' },
  { id: View.COMMUNITY, label: 'Community', icon: 'Users' },
  { id: View.COURSES, label: 'Courses', icon: 'GraduationCap' },
  { id: View.CALENDAR, label: 'Calendar', icon: 'Calendar' },
  { id: View.MESSAGES, label: 'Messages', icon: 'MessageSquare' },  // NEW
];

// Add View.MESSAGES enum
export enum View {
  // ... existing
  MESSAGES = 'messages',
}
```

### 4.2 Sidebar Logic Update

```typescript
// Sidebar.tsx
const getNavItems = () => {
  if (isTeamMemberOnly) {
    return TEAM_MEMBER_NAV_ITEMS;
  }

  if (isCreator) {
    return [...NAV_ITEMS, ...CREATOR_NAV_ITEMS];
  }

  return NAV_ITEMS.filter(item => {
    if (isStudent && item.id === View.AI_MANAGER) return false;
    return true;
  });
};
```

---

## Part 5: Acceptance Flow Detail

### 5.1 Accept Invitation Function

```typescript
// teamService.ts
export async function acceptTeamInvitation(
  token: string,
  profileId: string
): Promise<{ success: boolean; communityId?: string; error?: string }> {
  // 1. Find and validate invite
  const { data: invite, error: findError } = await supabase
    .from('community_team_members')
    .select('*, communities(id, name, creator_id)')
    .eq('invite_token', token)
    .eq('invite_status', 'pending')
    .single();

  if (findError || !invite) {
    return { success: false, error: 'Invalid or expired invitation' };
  }

  // 2. Check expiration
  if (new Date(invite.invite_expires_at) < new Date()) {
    return { success: false, error: 'This invitation has expired' };
  }

  // 3. Update team member record
  const { error: updateError } = await supabase
    .from('community_team_members')
    .update({
      profile_id: profileId,
      invited_email: null,  // Clear email once linked
      invite_token: null,   // Clear token (single-use)
      invite_status: 'accepted',
    })
    .eq('id', invite.id);

  if (updateError) {
    return { success: false, error: 'Failed to accept invitation' };
  }

  // 4. Create community membership if doesn't exist
  const { data: existingMembership } = await supabase
    .from('memberships')
    .select('id')
    .eq('community_id', invite.community_id)
    .eq('user_id', profileId)
    .single();

  if (!existingMembership) {
    await supabase
      .from('memberships')
      .insert({
        community_id: invite.community_id,
        user_id: profileId,
        role: 'member',
      });
  }

  return {
    success: true,
    communityId: invite.community_id
  };
}
```

### 5.2 Revoke Invitation Function

```typescript
// teamService.ts
export async function revokeTeamInvitation(
  teamMemberId: string
): Promise<{ success: boolean; error?: string }> {
  // Only revoke if still pending
  const { error } = await supabase
    .from('community_team_members')
    .delete()
    .eq('id', teamMemberId)
    .eq('invite_status', 'pending');

  if (error) {
    return { success: false, error: 'Failed to revoke invitation' };
  }

  return { success: true };
}
```

---

## Part 6: Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `src/public-pages/invite/TeamInvitePage.tsx` | Invite acceptance page |
| `src/features/team/TeamDashboard.tsx` | Team member dashboard |
| `src/features/team/TeamInboxPage.tsx` | Full-page DM inbox |
| `src/features/team/TeamProfileSettings.tsx` | Team profile editing |

### Modified Files
| File | Changes |
|------|---------|
| `src/core/types.ts` | Add `View.MESSAGES` enum |
| `src/core/constants.ts` | Add `TEAM_MEMBER_NAV_ITEMS` |
| `src/core/contexts/AuthContext.tsx` | Add team membership detection |
| `src/core/contexts/CommunityContext.tsx` | Handle team-only community locking |
| `src/shared/Sidebar.tsx` | Conditional nav items for team members |
| `src/App.tsx` | Add routes for invite page, messages page |
| `src/features/direct-messages/teamService.ts` | Add token generation, accept, revoke |
| `src/features/direct-messages/components/InviteTeamMemberModal.tsx` | Show copyable link |

### Database Migration
```sql
-- 028_team_invite_links.sql
ALTER TABLE community_team_members
ADD COLUMN invite_token TEXT UNIQUE,
ADD COLUMN invite_expires_at TIMESTAMPTZ,
ADD COLUMN invite_created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX idx_team_members_invite_token
ON community_team_members (invite_token)
WHERE invite_token IS NOT NULL;
```

---

## Part 7: Implementation Order

### Phase 1: Foundation
1. Apply database migration (add token columns)
2. Update teamService with token generation, accept, revoke functions
3. Update InviteTeamMemberModal to show copyable link

### Phase 2: Invite Flow
4. Create TeamInvitePage component
5. Add route `/invite/team/:token`
6. Test full invite → accept flow

### Phase 3: Team Member Detection
7. Update AuthContext with team membership detection
8. Update CommunityContext with team-only mode

### Phase 4: Team UI
9. Add `View.MESSAGES` and `TEAM_MEMBER_NAV_ITEMS`
10. Update Sidebar for team members
11. Create TeamDashboard component
12. Create TeamInboxPage component

### Phase 5: Polish
13. Add translations for all new UI
14. Test complete flow end-to-end
15. Handle edge cases (multiple team memberships, mixed roles)

---

## Questions Resolved

| Question | Decision |
|----------|----------|
| Single-use links? | ✅ Yes - token cleared on accept |
| Expiration? | ✅ 7 days |
| Revocable? | ✅ Yes - creator can delete pending invite |
| Auto-create membership? | ✅ Yes - on accept, create membership if missing |
