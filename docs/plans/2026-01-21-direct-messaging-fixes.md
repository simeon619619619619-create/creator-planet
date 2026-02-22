# Direct Messaging - Fixes Plan

Based on Codex code review dated 2026-01-15. All 9 findings validated as real issues.

---

## Priority 1: Critical/High Issues

### 1. Fix Unread Count Duplication (HIGH - Data Integrity)

**Problem**: Both DB triggers AND client code update `last_message_at` and unread counts, causing double increments.

**DB triggers** (from migrations):
- `trigger_update_conversation_last_message`
- `trigger_update_unread_count`

**Client code** (`src/features/direct-messages/dmService.ts:334-371`):
- Also updates `last_message_at` and increments unread counts

**Fix**: Remove client-side unread count updates. Keep DB triggers as single source of truth.

**File**: `src/features/direct-messages/dmService.ts`
```typescript
// In sendMessage(), remove lines 334-371 (unread count updates)
// DB triggers handle this automatically
```

---

### 2. Fix Creator Oversight Can Send Messages (HIGH - UX Bug)

**Problem**: `canSendMessages` checks if creator is a team member, but should check if they're an actual conversation participant.

**Current** (`src/features/direct-messages/components/ChatPanel.tsx:245`):
```typescript
const canSendMessages = !isCreator || (selectedConversation && isCurrentUserTeamMember);
```

**Fix**: Use the `canSendMessage()` helper from dmService or check actual participation:
```typescript
// Either use the existing canSendMessage() service function, or:
const isParticipant = selectedConversation && (
  selectedConversation.student_profile_id === currentUserProfileId ||
  selectedConversation.team_member?.profile_id === currentUserProfileId
);
const canSendMessages = !selectedConversation || isParticipant;
```

---

### 3. Auto-Accepted Team Invites Should Create Membership (HIGH - Access Bug)

**Problem**: When inviting an existing user, they're auto-accepted as team member but don't get a community membership, so they can't access the community UI.

**Location**: `src/features/direct-messages/teamService.ts:151-175`

**Fix**: After auto-accepting existing user, also create membership if they don't have one:
```typescript
// After line 165 (after insert succeeds), add:
if (existingProfile && data) {
  // Check if they're already a community member
  const { data: existingMembership } = await supabase
    .from('memberships')
    .select('id')
    .eq('community_id', communityId)
    .eq('user_id', existingProfile.id)
    .single();

  // If not a member, create membership
  if (!existingMembership) {
    await supabase
      .from('memberships')
      .insert({
        community_id: communityId,
        user_id: existingProfile.id,
        role: 'member',
      });
  }
}
```

---

## Priority 2: Medium Issues

### 4. Hide Pending Invites from Non-Creators (MEDIUM - Privacy)

**Problem**: RLS SELECT policy on `community_team_members` shows all rows to community members, including pending invites with email addresses.

**Fix**: Add RLS migration to split policies:
```sql
-- Drop existing permissive SELECT policy
DROP POLICY IF EXISTS "Community members can view team" ON community_team_members;

-- Members only see accepted team members
CREATE POLICY "Community members can view accepted team" ON community_team_members
FOR SELECT TO authenticated
USING (
  invite_status = 'accepted'
  AND community_id IN (
    SELECT community_id FROM memberships
    WHERE user_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

-- Creators can see ALL (including pending invites)
CREATE POLICY "Creators can view all team members" ON community_team_members
FOR SELECT TO authenticated
USING (
  community_id IN (
    SELECT id FROM communities
    WHERE creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);
```

---

### 5. Non-Messageable Team Members Should See Own Inbox (MEDIUM - UX)

**Problem**: `getTeamMembers()` and `getTeamMembersWithUnread()` filter by `is_messageable = true`, hiding non-messageable team members from sidebar entirely.

**Fix**: Add condition to include self regardless of `is_messageable`:
```typescript
// In dmService.ts getTeamMembers(), modify query:
.or(`is_messageable.eq.true,profile_id.eq.${currentProfileId}`)
```

Or better: provide separate "My Inbox" entry that doesn't depend on team list visibility.

---

## Priority 3: Low Issues (Defer or Quick Wins)

### 6. Wire Promote Existing Member UI (LOW - Missing Feature)

**Problem**: `addTeamMember()` exists in teamService.ts but has no UI entry point.

**Fix**: Add "Add from Members" button in team settings that:
1. Opens modal to search existing community members
2. Calls `addTeamMember()` with selected profile

**Deferred**: Feature works end-to-end, just needs UI wiring.

---

### 7. Fix N+1 Last Message Queries (LOW - Performance)

**Problem**: `getTeamMemberConversations()`, `getCommunityConversations()`, etc. fetch last message per conversation in separate queries.

**Fix options**:
1. Add `last_message_preview` column to `direct_conversations` (updated by trigger)
2. Use window function to fetch in single query
3. Create database view with last message included

**Deferred**: Only impacts performance with many conversations.

---

### 8. Add Unique Constraint on invited_email (LOW - Data Integrity)

**Problem**: Only app logic prevents duplicate invites by email. No DB constraint.

**Fix**: Add partial unique index:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS unique_invite_email_per_community
ON community_team_members (community_id, invited_email)
WHERE invited_email IS NOT NULL;
```

---

### 9. Invite Flow for New Emails (CRITICAL but DEFERRED)

**Problem**: Pending invites are created but there's no email sending or acceptance flow.

**Current state**: `// TODO: Send invitation email if profile doesn't exist` in teamService.ts:172

**This is a product decision**:
- Option A: Send Supabase auth invite email + tokenized acceptance link
- Option B: Use in-app notification when user signs up with invited email
- Option C: Remove invite-by-email entirely, only allow promoting existing members

**Deferred**: Requires product decision on invite mechanism.

---

## Implementation Order

### Phase 1 (Quick Fixes - Do Now)
1. Fix unread count duplication (remove client-side updates)
2. Fix creator oversight composer visibility
3. Auto-create membership for auto-accepted invites

### Phase 2 (Privacy & UX)
4. Add RLS for pending invite privacy
5. Allow non-messageable team members to see own inbox

### Phase 3 (Deferred)
6. Wire promote member UI
7. Optimize N+1 queries
8. Add unique constraint on invited_email
9. Implement full invite email flow (needs product decision)

---

## Questions for Product

1. Should invited team members automatically join the community, or should team access be separate from community membership?
2. For existing users, should invites auto-accept (current behavior) or require explicit acceptance?
3. What is the desired email/invite mechanism: Supabase auth invites, custom tokenized links, or just notifications?
