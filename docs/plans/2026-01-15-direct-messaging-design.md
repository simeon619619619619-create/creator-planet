# Direct Messaging & Team Members Design

**Date:** 2026-01-15
**Status:** Approved
**Author:** Brainstorming session

## Overview

Add 1:1 direct messaging between students and community team members (lecturers, assistants, guest experts). This enables support/Q&A and casual community engagement while keeping coaching sessions with calendar/Zoom links.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Messaging style | Async (not real-time) | Matches existing pull-based architecture |
| Team types | Permanent team + Guest experts | Flexible staffing model |
| Visual distinction | Badges ("Team" vs "Guest") | Clear without cluttering UI |
| Visibility model | Creator sees all, lecturers see own | Oversight without impersonation |
| Adding team | Invite by email + Promote existing | Both paths for flexibility |
| Discovery | Sidebar + Contextual + Profiles | Multiple entry points |

## Data Model

### New Tables

```sql
-- Team members within a community
CREATE TABLE community_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('lecturer', 'assistant', 'guest_expert')),
  title TEXT, -- "Course Instructor", "Guest Speaker", etc.
  bio TEXT, -- Short description shown to students
  is_messageable BOOLEAN DEFAULT true,
  invited_email TEXT, -- For pending invites (before account created)
  invite_status TEXT DEFAULT 'accepted' CHECK (invite_status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Either profile_id OR invited_email must be set
  CONSTRAINT profile_or_invite CHECK (
    (profile_id IS NOT NULL AND invited_email IS NULL) OR
    (profile_id IS NULL AND invited_email IS NOT NULL)
  ),
  -- Unique team member per community
  UNIQUE (community_id, profile_id)
);

-- Conversation between student and team member
CREATE TABLE direct_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  student_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES community_team_members(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  unread_count_student INT DEFAULT 0,
  unread_count_team INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- One conversation per student-team member pair
  UNIQUE (community_id, student_profile_id, team_member_id)
);

-- Individual messages
CREATE TABLE direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  sender_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_team_members_community ON community_team_members(community_id);
CREATE INDEX idx_conversations_student ON direct_conversations(student_profile_id);
CREATE INDEX idx_conversations_team_member ON direct_conversations(team_member_id);
CREATE INDEX idx_messages_conversation ON direct_messages(conversation_id);
CREATE INDEX idx_messages_created ON direct_messages(created_at DESC);
```

### RLS Policies

```sql
-- Team members: visible to community members
CREATE POLICY "Community members can view team"
  ON community_team_members FOR SELECT
  TO authenticated
  USING (
    community_id IN (
      SELECT community_id FROM memberships
      WHERE user_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Creator can manage team
CREATE POLICY "Creator can manage team"
  ON community_team_members FOR ALL
  TO authenticated
  USING (
    community_id IN (
      SELECT id FROM communities
      WHERE creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Conversations: students see their own, team sees theirs, creator sees all
CREATE POLICY "Users can view their conversations"
  ON direct_conversations FOR SELECT
  TO authenticated
  USING (
    student_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR team_member_id IN (
      SELECT id FROM community_team_members
      WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
    OR community_id IN (
      SELECT id FROM communities
      WHERE creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Messages: participants can view, creator can view all in their communities
CREATE POLICY "Conversation participants can view messages"
  ON direct_messages FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM direct_conversations WHERE
        student_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR team_member_id IN (
          SELECT id FROM community_team_members
          WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
        OR community_id IN (
          SELECT id FROM communities
          WHERE creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    )
  );

-- Only conversation participants can send messages (not creator oversight)
CREATE POLICY "Participants can send messages"
  ON direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM direct_conversations WHERE
        student_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR team_member_id IN (
          SELECT id FROM community_team_members
          WHERE profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    )
  );
```

## UI/UX Design

### Sidebar Structure

```
▼ ОБЩИ (Channels)
  # general
  # wins
  # help-needed
  # announcements

▼ ЕКИП (Team)                    ← New collapsible section
  👤 Иван Петров     [Team]      ← Badge + unread dot
  👤 Мария Димитрова [Team]  •   ← Unread indicator
  👤 John Smith      [Guest]

🤖 AI Асистенти                  ← Existing chatbots
  🤖 Q&A Bot
  🤖 Motivation Coach

🏆 Класация
```

### Student Experience

1. **Click lecturer in sidebar** → Chat panel opens on right (replaces posts area)
2. **Chat panel contents:**
   - Header: Lecturer avatar, name, title, [Team/Guest] badge
   - Message history (scrollable)
   - Input field with send button
3. **Unread indicator:** Blue dot on lecturer name when new messages

### Creator Experience

1. **Click any lecturer** → See that lecturer's inbox (all their conversations)
2. **Inbox view:**
   - Header: "← Back | Иван Петров's Inbox | 12 chats"
   - List of conversations: Student name, last message preview, timestamp, unread dot
3. **Click conversation** → Read-only view of full chat thread
4. **Cannot reply** (oversight only, no impersonation)

### Lecturer Experience

1. **Click own entry in sidebar** → See personal inbox
2. **Same inbox view as creator sees** but only own conversations
3. **Can reply** to student messages

## Discovery Entry Points

### 1. Sidebar Team Section
- Always visible when in community
- Shows all messageable team members
- Unread indicators per lecturer

### 2. Course Pages
```
┌─────────────────────────────────────────────┐
│ Course: Advanced Fashion Design             │
│ Instructor: Иван Петров [Team]              │
│                                             │
│ [💬 Message Instructor]  [📅 Book Session]  │
└─────────────────────────────────────────────┘
```

### 3. Post Author Popups
When clicking team member's avatar on a post:
```
┌──────────────────────────┐
│  👤 Мария Димитрова      │
│  Assistant [Team]        │
│  "Helping with Q&A"      │
│                          │
│  [💬 Send Message]       │
│  [View Profile]          │
└──────────────────────────┘
```

### 4. Team Profile Pages
Route: `/community/:communityId/team/:memberId`
- Avatar, name, title, bio
- Courses they teach
- [Message] button

## Team Management

### Settings Tab: "Team"

```
┌─────────────────────────────────────────────┐
│ Team Members                    [+ Invite]  │
├─────────────────────────────────────────────┤
│ 👤 Иван Петров    Lecturer  [Team]   ⚙️ ✕  │
│    ivan@email.com  •  Can receive DMs       │
│                                             │
│ 👤 Мария Димитрова  Assistant [Team]  ⚙️ ✕ │
│    maria@email.com  •  Can receive DMs      │
│                                             │
│ ✉️ john@expert.com   [Pending invite]   ✕   │
│    Guest Expert - Awaiting acceptance       │
└─────────────────────────────────────────────┘
```

### Invite Flow

1. Creator clicks "+ Invite"
2. Modal: Email, Role (Lecturer/Assistant/Guest Expert), Title, Bio
3. System sends invite email with link
4. **New user:** Creates account → Auto-joined as team member
5. **Existing user:** Clicks link → Added to team

### Promote Existing Member

1. In community member list, click user
2. Select "Add to Team"
3. Choose role and title
4. User appears in team section

## Technical Considerations

### No Real-Time (MVP)

- Pull-based like existing posts/comments
- Unread counts updated on fetch
- Future: Add Supabase Realtime subscriptions

### Notifications (Future)

- Email notifications for new DMs (optional setting)
- Push notifications (future mobile app)

### Performance

- Index on conversation lookups
- Pagination for message history (load 50 at a time)
- Lazy load conversations in inbox

## File Structure

```
src/features/direct-messages/
├── components/
│   ├── TeamSection.tsx          # Sidebar team list
│   ├── ChatPanel.tsx            # Main chat interface
│   ├── ConversationList.tsx     # Inbox view
│   ├── MessageThread.tsx        # Message history
│   ├── MessageInput.tsx         # Compose message
│   └── TeamMemberCard.tsx       # Profile popup/card
├── pages/
│   ├── TeamProfilePage.tsx      # /community/:id/team/:memberId
│   └── TeamSettingsTab.tsx      # Settings > Team management
├── dmService.ts                 # CRUD operations
├── teamService.ts               # Team member management
└── dmTypes.ts                   # TypeScript interfaces
```

## Implementation Phases

### Phase 1: Foundation
- [ ] Database migration (tables, RLS, indexes)
- [ ] TypeScript types
- [ ] Basic service functions (CRUD)

### Phase 2: Team Management
- [ ] Team settings tab UI
- [ ] Invite flow (email + accept)
- [ ] Promote existing member

### Phase 3: Messaging UI
- [ ] Sidebar team section
- [ ] Chat panel component
- [ ] Send/receive messages

### Phase 4: Discovery & Polish
- [ ] Course page "Message Instructor" button
- [ ] Post author profile popup
- [ ] Team profile pages
- [ ] Translations (EN/BG)

### Phase 5: Creator Oversight
- [ ] Lecturer inbox view
- [ ] Creator oversight dashboard
- [ ] Read-only conversation view
