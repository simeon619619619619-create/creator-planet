# Gated Community Access Design

**Date:** 2026-01-21
**Status:** Approved

## Overview

Allow creators to gate free communities so users must apply to join. Creators review applications in Student Manager and approve or reject.

## Scope

- **In scope:** Free communities only
- **Out of scope:** Paid communities (always instant access after payment)

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Application info | Optional message | Low friction, but allows students to introduce themselves |
| Creator management | Applications tab in Student Manager | Fits existing student management workflow |
| Rejection handling | Silent, no reapply | Simple for MVP, prevents spam |
| Notifications | None | User checks community page for status |

## Database Schema

### New column on `communities` table

```sql
ALTER TABLE communities
ADD COLUMN access_type TEXT DEFAULT 'open'
CHECK (access_type IN ('open', 'gated'));
```

- `open` = anyone can join free communities instantly (current behavior)
- `gated` = users must apply, creator approves

### New `community_applications` table

```sql
CREATE TABLE community_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT,  -- optional intro message from applicant
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id),  -- creator who reviewed
  UNIQUE(community_id, user_id)  -- one application per user per community
);

-- Indexes
CREATE INDEX idx_community_applications_community ON community_applications(community_id);
CREATE INDEX idx_community_applications_user ON community_applications(user_id);
CREATE INDEX idx_community_applications_status ON community_applications(status);
```

### RLS Policies

```sql
-- Users can view their own applications
CREATE POLICY "Users can view own applications"
ON community_applications FOR SELECT
TO authenticated
USING (user_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Users can create applications for gated communities they're not in
CREATE POLICY "Users can apply to gated communities"
ON community_applications FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE community_id = community_applications.community_id
    AND user_id = community_applications.user_id
  )
);

-- Creators can view applications for their communities
CREATE POLICY "Creators can view applications"
ON community_applications FOR SELECT
TO authenticated
USING (
  community_id IN (
    SELECT id FROM communities
    WHERE creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

-- Creators can update applications for their communities
CREATE POLICY "Creators can review applications"
ON community_applications FOR UPDATE
TO authenticated
USING (
  community_id IN (
    SELECT id FROM communities
    WHERE creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);
```

## User Flows

### Student Flow (applying to gated community)

1. **Landing page** (`/community/:id`) - sees "Apply to Join" button instead of "Join"
2. **Apply modal** - optional textarea for intro message, "Submit Application" button
3. **After applying** - button changes to "Application Pending" (disabled, clock icon)
4. **If approved** - next visit shows "Go to Community" (same as current member state)
5. **If rejected** - button shows "Application Denied" (disabled, grayed out, cannot reapply)

### Creator Flow (managing applications)

1. **Student Manager** - new "Applications" tab with badge showing pending count
2. **Applications list** shows:
   - Applicant avatar, name
   - Community they applied to (if creator has multiple gated communities)
   - Optional message (expandable)
   - Applied date
   - "Approve" / "Reject" buttons
3. **Approve** → Creates membership, updates application status to approved
4. **Reject** → Updates status to rejected (kept for blocking reapplies)

### Creator Setting (per-community)

In community edit modal:
- Toggle: "Require approval to join" (only shown for free communities)
- Default: off (open access)

## Files to Modify

### Database
- **Migration**: Add `access_type` column to `communities`, create `community_applications` table with RLS policies

### Backend Services
- **`src/features/community/communityService.ts`**
  - `applyToCommunity(userId, communityId, message?)`
  - `getApplication(userId, communityId)`
  - `getCommunityApplications(communityId, status?)`
  - `getCreatorApplications(creatorId)` - all applications across creator's communities
  - `approveApplication(applicationId, reviewerId)`
  - `rejectApplication(applicationId, reviewerId)`

### Student-facing UI
- **`src/public-pages/communities/JoinButton.tsx`**
  - Check if community is gated
  - Check for existing application status
  - Show appropriate button state (Apply / Pending / Denied / Member)
  - Open apply modal for gated communities

- **New `src/public-pages/communities/ApplyModal.tsx`**
  - Simple modal with optional textarea
  - "Submit Application" button
  - Loading/success states

### Creator-facing UI
- **`src/features/student-manager/StudentManagerPage.tsx`**
  - Add "Applications" tab with pending count badge

- **New `src/features/student-manager/ApplicationsTab.tsx`**
  - List pending applications
  - Applicant info with avatar, name, message
  - Approve/Reject buttons
  - Filter by community (if multiple)

- **Community edit modal (CreateCommunityModal or similar)**
  - Add "Require approval to join" toggle
  - Only show for free communities (`pricing_type === 'free'`)

### Types
- **`src/features/community/communityTypes.ts`**
  - Add `CommunityApplication` interface
  - Update `Community` type with `access_type`

### Translations
- **`src/i18n/locales/en.json`** and **`bg.json`**
  - Application button states
  - Apply modal text
  - Applications tab labels
  - Approve/reject actions
  - Community setting toggle

## Implementation Order

1. Database migration (schema + RLS)
2. Types and service functions
3. JoinButton modifications + ApplyModal
4. Student Manager Applications tab
5. Community edit toggle
6. Translations (EN + BG)
7. Testing
