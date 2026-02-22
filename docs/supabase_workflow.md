# Supabase Workflow Guide

## Quick Reference

### Project Details
- **Project ID:** `znqesarsluytxhuiwfkt`
- **Project Name:** Creator Club
- **Region:** (check dashboard)

### MCP Setup (Recommended)
The Supabase MCP is configured in `.mcp.json`. It provides direct API access - much faster than Playwright browser automation.

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=znqesarsluytxhuiwfkt"
    }
  }
}
```

**First-time setup:** Claude Code will prompt for browser authentication on first use.

### Available MCP Tools
Once connected, use these tools for database operations:

| Tool | Purpose |
|------|---------|
| `mcp__supabase__execute_sql` | Run SQL queries directly |
| `mcp__supabase__list_tables` | View all tables in schema |
| `mcp__supabase__get_table_schema` | Inspect table structure |
| `mcp__supabase__list_policies` | View RLS policies |
| `mcp__supabase__apply_migration` | Apply schema changes |

---

## Database Schema

### Core Tables
- `profiles` - User profiles (linked to auth.users)
- `communities` - Creator communities
- `community_channels` - Channels within communities
- `memberships` - User community memberships
- `posts` - Community posts
- `post_comments` - Post comments
- `post_likes` - Post likes

### Course/LMS Tables
- `courses` - Course definitions
- `modules` - Course modules
- `lessons` - Individual lessons
- `enrollments` - Student enrollments
- `lesson_progress` - Student progress tracking
- `student_health` - AI risk scoring data

### Gamification Tables
- `points` - User point balances
- `point_transactions` - Point history

### Other Tables
- `events` - Calendar events
- `event_attendees` - Event RSVPs
- `tasks` - Creator tasks/reminders

---

## Common Operations

### Execute SQL Query
```
Use mcp__supabase__execute_sql with your SQL statement
```

### Check RLS Policies
```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Add New RLS Policy
```sql
CREATE POLICY "policy_name"
  ON public.table_name
  FOR SELECT/INSERT/UPDATE/DELETE/ALL
  USING (condition)
  WITH CHECK (condition);
```

### Drop Existing Policy
```sql
DROP POLICY IF EXISTS "policy_name" ON public.table_name;
```

---

## Known Issues & Fixes

### RLS Infinite Recursion (Error 42P17)
**Cause:** Circular dependencies where Table A's policy queries Table B, and Table B's policy queries Table A.

**Example:** `courses` policy checked `enrollments`, `enrollments` policy checked `courses`.

**Fix:** Use simple, non-recursive policies:
```sql
-- BAD: Recursive
CREATE POLICY "view_enrolled" ON courses FOR SELECT
  USING (id IN (SELECT course_id FROM enrollments WHERE user_id = auth.uid()));

-- GOOD: Non-recursive
CREATE POLICY "view_published" ON courses FOR SELECT
  USING (is_published = true);
```

### Profile ID Mismatch
**Issue:** `profiles.id` must match `auth.uid()` for foreign key relationships to work.

**Fix:**
```sql
-- Ensure profile.id = auth user id
INSERT INTO profiles (id, user_id, email, full_name, role, created_at)
VALUES (
  'auth-user-uuid-here',
  'auth-user-uuid-here',
  'email@example.com',
  'Name',
  'creator'::user_role,
  NOW()
);
```

### Missing INSERT Policies
Tables need explicit INSERT policies for users to create records:
```sql
CREATE POLICY "Users can join communities"
  ON public.memberships FOR INSERT
  WITH CHECK (user_id = auth.uid());
```

---

## Migration Files

Located in `/supabase/migrations/`:

| File | Purpose |
|------|---------|
| `001_initial_schema.sql` | Base tables |
| `002_phase2_schema.sql` | Additional MVP tables |
| `003_auth_profiles.sql` | Auth & profiles setup |
| `004_gamification.sql` | Points & leaderboard |
| `005_fix_rls_recursion.sql` | RLS recursion fix (superseded) |
| `006_complete_rls_fix.sql` | Comprehensive RLS rewrite |

---

## Security Best Practices

1. **Never expose `service_role` key** in frontend code
2. **Always use RLS** for user-facing tables
3. **Test policies** with actual user context
4. **Avoid recursive policies** that cross-reference tables
5. **Use `auth.uid()`** for user-specific policies

---

## Fallback: Playwright Method

If MCP is unavailable, use Playwright to interact with Supabase Dashboard:

1. Navigate to SQL Editor
2. Inject SQL via Monaco editor
3. Click Run button
4. Parse results

**Note:** This is 10x slower than MCP and should only be used as fallback.

---

## Environment Variables

Required in `.env`:
```
VITE_SUPABASE_URL=https://znqesarsluytxhuiwfkt.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

For backend/admin operations (never in frontend):
```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```
