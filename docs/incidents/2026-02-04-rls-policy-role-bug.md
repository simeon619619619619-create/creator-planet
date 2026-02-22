# Incident Report: RLS Policy Role Bug - 2026-02-04

## Summary

A critical Row Level Security (RLS) policy bug was discovered that prevented all authenticated users from accessing their own data. Approximately 100+ policies were affected across all major tables.

## Timeline

- **2026-02-04 ~18:51**: Applied migration `team_member_permissions` to add team member access policies
- **2026-02-04 ~18:58**: Applied multiple fix migrations to correct the RLS role issue
- **2026-02-04 ~19:10**: Discovered all users showing as "User" / "Member" instead of their actual profiles

## Root Cause

### The `{public}` Role Problem

In Supabase/PostgreSQL, when you create an RLS policy **without** an explicit `TO` clause, it defaults to the `PUBLIC` pseudo-role:

```sql
-- WRONG - defaults to 'public' role
CREATE POLICY "Users can view own profile"
ON profiles
FOR SELECT
USING (auth.uid() = user_id);
-- ^ This stores roles: {public}
```

**Critical misconception**: Many developers assume the `public` role in PostgreSQL grants access to all users. However, in Supabase:

- The `anon` role is for unauthenticated users
- The `authenticated` role is for logged-in users
- **Neither inherits from `{public}`!**

So when a policy has `roles: {public}`, it applies to **neither** authenticated nor anonymous users in practice.

### How This Happened

1. The original database migrations were created without explicit `TO` clauses
2. Policies were stored with `roles: {public}`
3. This was "hidden" because:
   - Some queries worked through other policies that were correct
   - Some data was visible through `anon` policies for public pages
   - The bug only manifests when **all** policies on a table use `{public}`
4. The `team_member_permissions` migration added new policies correctly with `TO authenticated`
5. This didn't fix the underlying issue - existing broken policies remained broken

### Evidence

Query to identify affected policies:
```sql
SELECT tablename, policyname, roles
FROM pg_policies
WHERE roles = '{public}'
ORDER BY tablename;
```

Before fix: ~100 policies with `{public}` role
After fix: 0 policies with `{public}` role (all converted to `{authenticated}` or `{anon}`)

## Symptoms

- All users displayed as "User" / "Member" in the sidebar
- Dashboard stuck on loading spinner
- Profile fetch failed with console error: "Error fetching profile: Object"
- No courses, communities, or other user data visible after login

## Migrations Applied to Fix

1. `fix_events_policies_roles` - Fixed events SELECT policies
2. `fix_profiles_policies_roles` - Fixed profiles policies
3. `fix_communities_memberships_policies_roles` - Fixed communities/memberships
4. `add_anon_courses_policy` - Added anon viewing for public courses
5. `fix_critical_policies_batch1` - Fixed courses, enrollments, lessons, modules
6. `fix_critical_policies_batch2` - Fixed channels, posts, points
7. `fix_critical_policies_batch3` - Fixed lesson_progress, creator_billing, event_attendees
8. `fix_user_policies_final_batch` - Fixed billing_plans, chatbots, dwy_packages, etc.
9. `fix_user_policies_final_batch2_fixed` - Fixed community_groups, purchases, discount_codes
10. `fix_user_policies_final_batch3_fixed` - Fixed discount_redemptions, student_health, weekly_reports
11. `fix_storage_and_superadmin_policies` - Fixed storage.objects policies
12. `fix_superadmin_policies` - Fixed superadmin-specific policies
13. `fix_profiles_recursion` - Simplified community members profiles policy

## Tables Affected

Major tables that had broken policies:
- `profiles` - User profiles (critical)
- `communities` - Communities
- `memberships` - Community memberships
- `courses` - Courses
- `enrollments` - Course enrollments
- `modules` - Course modules
- `lessons` - Lessons
- `lesson_progress` - Lesson completion tracking
- `events` - Calendar events
- `event_attendees` - Event RSVPs
- `posts` - Community posts
- `community_channels` - Community channels
- `points` - Point balances
- `point_transactions` - Point history
- `homework_assignments` - Homework
- `homework_submissions` - Student submissions
- `creator_billing` - Creator billing state
- `storage.objects` - File uploads (avatars, thumbnails, etc.)
- Plus ~50 more tables

## Resolution

### Root Cause Identified

The 500 Internal Server Error was caused by **complex RLS policies with subqueries** in the profiles table that triggered recursive policy evaluation:

1. **"Team members can view community member profiles"** (from migration 030):
   - Queried `memberships` and `community_team_members` tables directly in USING clause
   - These tables have their own RLS policies that call `get_my_profile_id()`
   - Created a chain of policy evaluations that overloaded the query planner

2. **"Community members can view fellow members profiles"**:
   - Used a self-join on memberships (`m1`, `m2`) which was expensive
   - Called `get_my_profile_id()` within the join condition

### Fix Applied

Migration `temporarily_simplify_profiles_policies` removed the complex policies and kept only simple, direct policies:

```sql
-- Removed these problematic policies:
DROP POLICY "Team members can view community member profiles" ON profiles;
DROP POLICY "Community members can view fellow members profiles" ON profiles;
DROP POLICY "Authenticated can view public community profiles" ON profiles;
DROP POLICY "Anon can view public profile info" ON profiles;

-- Kept these working policies:
-- "Users can view own profile" - uses auth.uid() = user_id (direct, no subqueries)
-- "Creators can view all profiles" - uses JWT metadata (no table queries)
-- "Superadmins can view all profiles" - uses JWT metadata (no table queries)
```

### Additional Fix: Sidebar Role Display

Users who were both creators AND team members (like Simeon) had their sidebar show "Лектор" (Lecturer) instead of "creator" because the display logic prioritized team role.

Fixed in `src/shared/Sidebar.tsx`:
```tsx
// Before (buggy):
{isTeamMemberOnly && teamTitle ? teamTitle : (teamRole ? getTeamRoleDisplay() : (profile?.role || 'Member'))}

// After (fixed):
{isCreator ? (profile?.role || 'creator') : (isTeamMemberOnly ? (teamTitle || getTeamRoleDisplay()) : (profile?.role || 'Member'))}
```

### Result

- Profile fetch now returns 200 OK instead of 500 Internal Server Error
- User profiles load correctly with proper names and roles
- Creators see "creator" role, team-only members see their team role

## Final Resolution (Complete)

### Migrations Applied

| Migration | Purpose |
|-----------|---------|
| `temporarily_simplify_profiles_policies` | Removed complex profile policies causing 500 errors |
| `fix_profile_function_and_simplify_policies` | Added `SET search_path` to SECURITY DEFINER functions |
| `add_simple_team_profile_viewing` | First attempt at profile viewing (caused recursion) |
| `fix_profile_viewing_for_community_members` | Second attempt (still caused recursion) |
| `fix_profile_policies_no_recursion_v2` | **Final fix** - Single `get_viewable_profile_ids()` function |
| `fix_channels_for_team_and_members` | Added team member channel viewing |
| `fix_groups_and_channels_rls` | Fixed groups and channels with `get_viewable_group_ids()` |

### Key Solution: Isolated SECURITY DEFINER Functions

The solution was to create SECURITY DEFINER functions that perform ALL lookups internally, preventing RLS recursion:

```sql
CREATE OR REPLACE FUNCTION public.get_viewable_profile_ids()
RETURNS SETOF UUID
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_profile_id UUID;
BEGIN
  -- All lookups happen here, bypassing RLS on other tables
  SELECT id INTO my_profile_id FROM profiles WHERE user_id = auth.uid();
  -- ... return all viewable profile IDs
END;
$$;

CREATE POLICY "Users can view related profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (id IN (SELECT get_viewable_profile_ids()));
```

### Verified Working

After all fixes:
- ✅ User profiles load with correct names (not "User" / "Anonymous")
- ✅ User roles display correctly (creators show "creator", team members show team role)
- ✅ Community channels are visible
- ✅ Community groups load without errors
- ✅ Team members visible in sidebar
- ✅ Post authors visible with real names
- ✅ No 500 errors on profile/channel/group fetches

### Frontend Fix (Needs Deployment)

File: `src/shared/Sidebar.tsx` - Changed role display logic to prioritize profile role for creators:
```tsx
// Before:
{isTeamMemberOnly && teamTitle ? teamTitle : (teamRole ? getTeamRoleDisplay() : (profile?.role || 'Member'))}

// After:
{isCreator ? (profile?.role || 'creator') : (isTeamMemberOnly ? (teamTitle || getTeamRoleDisplay()) : (profile?.role || 'Member'))}
```

## Prevention: Mandatory RLS Policy Checklist

Added to `CLAUDE.md`:

```markdown
### RLS Policy Creation (CRITICAL - Always Follow)

**MANDATORY: Always explicitly specify roles in CREATE POLICY:**

-- WRONG - defaults to 'public' role
CREATE POLICY "Users can do something"
ON my_table
FOR UPDATE
USING (...);

-- CORRECT - explicitly targets authenticated users
CREATE POLICY "Users can do something"
ON my_table
FOR UPDATE
TO authenticated  -- <-- ALWAYS include this
USING (...);
```

## Lessons Learned

1. **Always use explicit `TO` clause**: Never create a policy without `TO authenticated` or `TO anon`
2. **Test RLS with both roles**: After migrations, verify policies work for authenticated users
3. **Check pg_policies**: Verify `roles` column shows `{authenticated}` not `{public}`
4. **Profile ID vs User ID**: Remember the distinction - policies comparing user_id should use `auth.uid()`, policies comparing profile_id should use `get_my_profile_id()`

## Related Files

- `/supabase/migrations/030_team_member_permissions.sql` - Original team permissions migration
- `/supabase/migrations/fix_*.sql` - All fix migrations
- `/CLAUDE.md` - Updated with RLS policy guidelines
- `/src/core/contexts/AuthContext.tsx` - Profile fetching logic
