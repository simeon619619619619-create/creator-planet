# Gated Community Access - Fixes Plan

Based on code review from Codex. Three items need fixing.

## 1. payment_status Mismatch Bug (HIGH - Quick Fix)

**Problem**: Free community members get `payment_status = 'none'` (DB default), but JoinButton only considers `null` or `'paid'` as valid. Free members appear as non-members.

**File**: `src/public-pages/communities/JoinButton.tsx:142`

**Current code**:
```typescript
const isValidMember = paymentStatus === null || paymentStatus === 'paid';
```

**Fix**:
```typescript
const isValidMember = paymentStatus === null || paymentStatus === 'none' || paymentStatus === 'paid';
```

---

## 2. Server-side Gating Enforcement (CRITICAL - Security)

**Problem**: The memberships RLS policy "Users can join communities" allows ANY user to insert themselves into ANY community. A malicious user can bypass the UI and join gated communities directly via Supabase API.

**Current RLS** (memberships INSERT):
```sql
with_check: (user_id = get_my_profile_id())
```

**Fix**: Add check that either:
- Community is NOT gated, OR
- User has an APPROVED application

**New RLS Policy**:
```sql
-- Drop old permissive policy
DROP POLICY IF EXISTS "Users can join communities" ON memberships;

-- Create new policy with gating check
CREATE POLICY "Users can join communities" ON memberships
FOR INSERT TO authenticated
WITH CHECK (
  user_id = get_my_profile_id()
  AND (
    -- Either community is not gated
    NOT EXISTS (
      SELECT 1 FROM communities c
      WHERE c.id = community_id
      AND c.access_type = 'gated'
    )
    OR
    -- Or user has an approved application
    EXISTS (
      SELECT 1 FROM community_applications ca
      WHERE ca.community_id = memberships.community_id
      AND ca.user_id = memberships.user_id
      AND ca.status = 'approved'
    )
  )
);
```

---

## 3. Create Migration File for Documentation (LOW - Housekeeping)

**Problem**: The gated community schema was applied via MCP but no migration file exists for version control.

**Fix**: Create `supabase/migrations/027_gated_community_access.sql` containing:
- `communities.access_type` column (already in DB)
- `community_applications` table (already in DB)
- All RLS policies (already in DB)
- The security fix from item #2 above

This documents what's in the DB and includes the security fix.

---

## Implementation Order

1. **payment_status fix** - 1 line change, immediate fix
2. **Security migration** - Apply via Supabase MCP to fix the security hole
3. **Create migration file** - For documentation/reproducibility

## Files to Modify

| File | Change |
|------|--------|
| `src/public-pages/communities/JoinButton.tsx` | Add `'none'` to valid payment statuses |
| `supabase/migrations/027_gated_community_access.sql` | Create file documenting schema + security fix |
| Database (via MCP) | Apply RLS security fix |
