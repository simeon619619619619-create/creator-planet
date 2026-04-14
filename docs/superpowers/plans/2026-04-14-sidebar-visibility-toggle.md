# Sidebar Visibility Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let creators hide sidebar sections from members per-community, while still seeing them (marked as hidden) in their own admin view.

**Architecture:** Add `sidebar_hidden_sections text[]` column to `communities`. New section in `CreatorSettings` renders toggles that auto-save via a new `updateCommunitySidebarHiddenSections` service function. `Sidebar.tsx` filters items for members; for creators, annotates hidden items with an `EyeOff` badge + reduced opacity. Route guard redirects non-creators away from hidden views.

**Tech Stack:** React 19 + TypeScript + Supabase (Postgres + RLS) + react-i18next + lucide-react + Playwright (E2E only, no unit test framework).

**Spec:** `docs/superpowers/specs/2026-04-14-sidebar-visibility-toggle-design.md`

---

## File Structure

**Create:**
- `supabase/migrations/<timestamp>_add_sidebar_hidden_sections.sql` — DB migration

**Modify:**
- `src/core/supabase/database.types.ts` — add `sidebar_hidden_sections` to `DbCommunity`
- `src/features/community/communityService.ts` — extend `updateCommunity` Pick + add dedicated helper
- `src/shared/Sidebar.tsx` — filter nav items, render creator-visible badge
- `src/features/settings/CreatorSettings.tsx` — render new Navigation section with toggles
- `src/i18n/locales/bg.json` — add `creatorSettings.navigation.*` keys
- `src/i18n/locales/en.json` — add `creatorSettings.navigation.*` keys
- `src/App.tsx` (or wherever view routing lives) — redirect guard for non-creators

---

## Task 1: Database migration — add `sidebar_hidden_sections` column

**Files:**
- Create: `supabase/migrations/20260414120000_add_sidebar_hidden_sections.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Add sidebar_hidden_sections to communities
-- Stores View IDs hidden from members. Empty array = all sections visible.
ALTER TABLE public.communities
ADD COLUMN IF NOT EXISTS sidebar_hidden_sections text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.communities.sidebar_hidden_sections IS
  'Array of sidebar section IDs (View enum values) hidden from members. Creators always see all sections.';
```

- [ ] **Step 2: Apply the migration to the remote Supabase project**

Run (project ref from CLAUDE.md):
```bash
cd "/Users/Sim/Desktop/проекти/creator-planet"
npx supabase db push
```

Expected: migration applied successfully to `ilntxxutxbygjuixrzng`.

- [ ] **Step 3: Verify the column exists**

Run:
```bash
npx supabase db dump --schema public --data-only=false | grep -A1 sidebar_hidden_sections
```

Expected: column definition appears with `text[]` and default `'{}'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260414120000_add_sidebar_hidden_sections.sql
git commit -m "feat(db): add sidebar_hidden_sections column to communities"
```

---

## Task 2: Update TypeScript types

**Files:**
- Modify: `src/core/supabase/database.types.ts`

- [ ] **Step 1: Locate the `DbCommunity` type**

Run:
```bash
grep -n "DbCommunity\b\|communities:" src/core/supabase/database.types.ts | head -10
```

- [ ] **Step 2: Add the field to `DbCommunity`**

Find the `DbCommunity` interface / type and add the field alongside existing boolean/array fields (e.g., near `shop_enabled`):

```ts
sidebar_hidden_sections: string[];
```

If the file uses the generated Supabase `Database` type shape with `Row`/`Insert`/`Update`, add it to all three:
- `Row`: `sidebar_hidden_sections: string[]`
- `Insert`: `sidebar_hidden_sections?: string[]`
- `Update`: `sidebar_hidden_sections?: string[]`

- [ ] **Step 3: Type-check passes**

Run:
```bash
npx tsc --noEmit
```

Expected: no new errors introduced by this change.

- [ ] **Step 4: Commit**

```bash
git add src/core/supabase/database.types.ts
git commit -m "feat(types): add sidebar_hidden_sections to DbCommunity"
```

---

## Task 3: Extend community service with sidebar update helper

**Files:**
- Modify: `src/features/community/communityService.ts:152-168`

- [ ] **Step 1: Extend the `updateCommunity` Pick to include the new field**

At line 154, extend the `Pick<DbCommunity, ...>` union to include `'sidebar_hidden_sections'`. The line becomes:

```ts
  updates: Partial<Pick<DbCommunity, 'name' | 'description' | 'thumbnail_url' | 'is_public' | 'category' | 'thumbnail_focal_x' | 'thumbnail_focal_y' | 'theme_color' | 'text_color' | 'accent_color' | 'secondary_color' | 'section_color' | 'button_color' | 'background_elements' | 'display_member_count' | 'sidebar_hidden_sections'>>
```

- [ ] **Step 2: Add a dedicated helper right after `updateCommunity` (after line 168)**

Insert this function:

```ts
/**
 * List of sidebar section IDs that creators may hide from members.
 * Matches View enum values used as nav item IDs in Sidebar.tsx.
 */
export const HIDEABLE_SIDEBAR_SECTIONS = [
  'DASHBOARD',
  'COMMUNITY',
  'COURSES',
  'homework',
  'messages',
  'ai_chat',
  'CALENDAR',
  'AI_MANAGER',
] as const;

export type HideableSidebarSection = typeof HIDEABLE_SIDEBAR_SECTIONS[number];

export async function updateCommunitySidebarHiddenSections(
  communityId: string,
  hiddenSections: HideableSidebarSection[]
): Promise<DbCommunity | null> {
  // Defensive: only allow whitelisted values
  const allowed = new Set<string>(HIDEABLE_SIDEBAR_SECTIONS);
  const sanitized = hiddenSections.filter((s) => allowed.has(s));

  const { data, error } = await supabase
    .from('communities')
    .update({
      sidebar_hidden_sections: sanitized,
      updated_at: new Date().toISOString(),
    })
    .eq('id', communityId)
    .select()
    .single();

  if (error) {
    console.error('Error updating sidebar hidden sections:', error);
    return null;
  }
  return data;
}
```

Values match `View` enum from `src/core/types.ts` (note the mixed casing — `DASHBOARD`, `homework`, etc. — which is preserved to stay consistent with existing usage as nav item `id`s).

- [ ] **Step 3: Type-check passes**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/community/communityService.ts
git commit -m "feat(community): add updateCommunitySidebarHiddenSections service"
```

---

## Task 4: Sidebar — filter items for members, badge for creators

**Files:**
- Modify: `src/shared/Sidebar.tsx:4,86-109,191-209`

- [ ] **Step 1: Add `EyeOff` to the lucide imports on line 4**

Change:
```ts
import { LayoutDashboard, Users, GraduationCap, Calendar, BrainCircuit, Settings, LogOut, ClipboardList, Bot, UserCog, Tag, ClipboardCheck, MessageSquare, UserCircle, ShoppingBag } from 'lucide-react';
```

To:
```ts
import { LayoutDashboard, Users, GraduationCap, Calendar, BrainCircuit, Settings, LogOut, ClipboardList, Bot, UserCog, Tag, ClipboardCheck, MessageSquare, UserCircle, ShoppingBag, EyeOff } from 'lucide-react';
```

- [ ] **Step 2: Update `getNavItems()` to annotate + filter**

Replace the current `getNavItems` implementation (lines 86–109) with:

```tsx
  const hiddenFromMembers = selectedCommunity?.sidebar_hidden_sections ?? [];

  // Returns nav items with a `hiddenFromMembers` flag. For non-creators the
  // hidden items are filtered out entirely. Creators keep them visible with
  // a badge so they can still navigate to sections they've hidden.
  const getNavItems = () => {
    // Team-only users get the team member nav items (AI Manager only for lecturers)
    if (isTeamMemberOnly) {
      const teamRole = teamMemberships?.[0]?.role;
      return TEAM_MEMBER_NAV_ITEMS
        .filter((item) => {
          if (item.id === View.AI_MANAGER && teamRole !== 'lecturer') return false;
          return true;
        })
        .map((item) => ({ ...item, hiddenFromMembers: hiddenFromMembers.includes(item.id) }))
        .filter((item) => !item.hiddenFromMembers); // team members treated as members
    }

    const baseItems = NAV_ITEMS
      .filter((item) => {
        if (isStudent && item.id === View.AI_MANAGER) return false;
        return true;
      });

    const combined = isCreator ? [...baseItems, ...CREATOR_NAV_ITEMS] : baseItems;

    return combined
      .map((item) => ({ ...item, hiddenFromMembers: hiddenFromMembers.includes(item.id) }))
      .filter((item) => isCreator || !item.hiddenFromMembers);
  };
```

- [ ] **Step 3: Update the nav item render block (lines 191–209) to show the creator badge**

Replace the existing `{getNavItems().map((item) => (` button block with:

```tsx
          {getNavItems().map((item) => (
            <button
              key={item.id}
              onClick={() => {
                navigate(viewToPath[item.id]);
                setCurrentView(item.id);
                setIsOpen(false);
              }}
              title={item.hiddenFromMembers ? t('creatorSettings.navigation.hiddenTooltip') : undefined}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                ${item.hiddenFromMembers ? 'opacity-60' : ''}
                ${currentView === item.id
                  ? 'bg-[var(--fc-surface-hover,#151515)] text-[var(--fc-surface-text,#FAFAFA)] border-l-2 border-[var(--fc-surface-text,#FAFAFA)]'
                  : 'text-[var(--fc-surface-muted,#A0A0A0)] hover:bg-[var(--fc-surface-hover,#151515)] hover:text-[var(--fc-surface-text,#FAFAFA)]'}
              `}
            >
              {iconMap[item.icon]}
              <span className="flex-1 text-left">{t(labelTranslationMap[item.id] || item.label)}</span>
              {item.hiddenFromMembers && <EyeOff size={14} className="shrink-0" />}
            </button>
          ))}
```

- [ ] **Step 4: Type-check passes**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/Sidebar.tsx
git commit -m "feat(sidebar): hide sections per community, badge hidden items for creators"
```

---

## Task 5: Route guard — redirect non-creators away from hidden views

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Locate where `currentView` and navigation happen**

Run:
```bash
grep -n "currentView\|selectedCommunity\|View\." src/App.tsx | head -30
```

Identify the component that holds `currentView` state and has access to `selectedCommunity` + `role`.

- [ ] **Step 2: Add a `useEffect` that watches for the active view becoming hidden**

Inside that component, after existing effects, add:

```tsx
  useEffect(() => {
    const isCreator = role === 'creator' || role === 'superadmin';
    if (isCreator) return; // creators can visit hidden sections
    const hidden = selectedCommunity?.sidebar_hidden_sections ?? [];
    if (hidden.includes(currentView)) {
      navigate('/dashboard');
      setCurrentView(View.DASHBOARD);
    }
  }, [currentView, selectedCommunity?.sidebar_hidden_sections, role, navigate]);
```

If `role`, `selectedCommunity`, or `navigate` are not already available in that scope, wire them in from `useAuth()`, `useCommunity()`, and `useNavigate()` — matching how `Sidebar.tsx` consumes them.

- [ ] **Step 3: Type-check passes**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(routing): redirect members off hidden sidebar sections"
```

---

## Task 6: Add i18n keys

**Files:**
- Modify: `src/i18n/locales/bg.json:3015` (inside `creatorSettings` block)
- Modify: `src/i18n/locales/en.json` (matching block)

- [ ] **Step 1: Add Bulgarian keys**

Inside the existing `"creatorSettings": { ... }` object in `bg.json`, add a `navigation` key:

```json
    "navigation": {
      "title": "Навигация / Меню",
      "description": "Избери кои секции да се показват на членовете на общността.",
      "helper": "Скритите секции остават видими за теб, маркирани с икона.",
      "hiddenTooltip": "Скрита за членове",
      "saved": "Запазено",
      "saveError": "Грешка при запис. Опитай отново.",
      "sections": {
        "DASHBOARD": "Табло",
        "COMMUNITY": "Общност",
        "COURSES": "Курсове",
        "homework": "Домашни",
        "messages": "Чатове",
        "ai_chat": "AI Чат",
        "CALENDAR": "Събития",
        "AI_MANAGER": "AI Мениджър"
      }
    },
```

Place it logically alongside the existing sub-objects inside `creatorSettings` (order doesn't matter for i18n, but keep the file valid JSON — add a comma after the preceding block and not after the closing brace of `creatorSettings`).

- [ ] **Step 2: Add matching English keys**

In `en.json`, add:

```json
    "navigation": {
      "title": "Navigation / Menu",
      "description": "Choose which sections are visible to members of this community.",
      "helper": "Hidden sections stay visible to you, marked with an icon.",
      "hiddenTooltip": "Hidden from members",
      "saved": "Saved",
      "saveError": "Save failed. Please try again.",
      "sections": {
        "DASHBOARD": "Dashboard",
        "COMMUNITY": "Community",
        "COURSES": "Classroom",
        "homework": "Homework",
        "messages": "Messages",
        "ai_chat": "AI Chat",
        "CALENDAR": "Calendar",
        "AI_MANAGER": "AI Success Manager"
      }
    },
```

- [ ] **Step 3: Validate JSON**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/bg.json'))" \
  && node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json'))" \
  && echo OK
```

Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/bg.json src/i18n/locales/en.json
git commit -m "feat(i18n): add creatorSettings.navigation keys"
```

---

## Task 7: CreatorSettings — new Navigation section with toggles

**Files:**
- Modify: `src/features/settings/CreatorSettings.tsx`

- [ ] **Step 1: Import dependencies at the top of the file**

Replace the existing imports (lines 1–8) by merging in the new ones. After modification the import block should contain:

```tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Loader2, Save, Sparkles, Wallet, CheckCircle, Clock, AlertTriangle, ArrowRight, Info,
  LayoutDashboard, Users, GraduationCap, ClipboardList, MessageSquare, Bot, Calendar, BrainCircuit,
} from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import { useCommunity } from '../../core/contexts/CommunityContext';
import { getCreatorProfile, updateCreatorProfile, CreatorProfile } from './profileService';
import { getConnectAccountStatus, createConnectAccount, getConnectOnboardingLink } from '../billing';
import type { ConnectAccountStatus } from '../billing';
import {
  HIDEABLE_SIDEBAR_SECTIONS,
  HideableSidebarSection,
  updateCommunitySidebarHiddenSections,
} from '../community/communityService';
```

- [ ] **Step 2: Inside the component, wire state and the toggle handler**

Near the other `useState` hooks (around line 43), add:

```tsx
  const { selectedCommunity, setSelectedCommunity } = useCommunity();
  const [savingNav, setSavingNav] = useState<HideableSidebarSection | null>(null);
  const [navError, setNavError] = useState<string | null>(null);
```

If `useCommunity()` does not expose `setSelectedCommunity`, inspect `src/core/contexts/CommunityContext.tsx` and either use the setter it exposes or (if none) call a `refreshCommunities` / equivalent after save. The goal is: after a successful toggle, the local `selectedCommunity` reflects the new `sidebar_hidden_sections` so the sidebar updates immediately.

Add a toggle handler inside the component body:

```tsx
  const toggleSectionVisibility = async (section: HideableSidebarSection, visible: boolean) => {
    if (!selectedCommunity) return;
    const current = selectedCommunity.sidebar_hidden_sections ?? [];
    const next = visible
      ? current.filter((s) => s !== section)
      : Array.from(new Set([...current, section]));

    setSavingNav(section);
    setNavError(null);
    const updated = await updateCommunitySidebarHiddenSections(
      selectedCommunity.id,
      next as HideableSidebarSection[],
    );
    setSavingNav(null);

    if (!updated) {
      setNavError(t('creatorSettings.navigation.saveError'));
      return;
    }
    // Reflect the change in context so the sidebar re-renders immediately.
    if (typeof setSelectedCommunity === 'function') {
      setSelectedCommunity(updated);
    }
  };
```

- [ ] **Step 3: Add a section-icon map near the other local constants**

Just below the `TIMEZONES` array (around line 28), add:

```tsx
const SECTION_ICON_MAP: Record<string, React.ReactNode> = {
  DASHBOARD: <LayoutDashboard size={18} />,
  COMMUNITY: <Users size={18} />,
  COURSES: <GraduationCap size={18} />,
  homework: <ClipboardList size={18} />,
  messages: <MessageSquare size={18} />,
  ai_chat: <Bot size={18} />,
  CALENDAR: <Calendar size={18} />,
  AI_MANAGER: <BrainCircuit size={18} />,
};
```

- [ ] **Step 4: Render the Navigation section in JSX**

Find the end of the Payout Status section (search for `creatorSettings.creator.payouts.section`) and, after its closing wrapper, render the new section. If the file renders multiple `<section>` blocks in sequence, insert this as a new peer:

```tsx
      {/* Navigation Visibility */}
      {selectedCommunity && (
        <section className="bg-[var(--fc-section,#0E0E0E)] border border-[var(--fc-border,#1F1F1F)] rounded-xl p-6 mt-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-[var(--fc-text,#FAFAFA)]">
              {t('creatorSettings.navigation.title')}
            </h3>
            <p className="text-sm text-[var(--fc-muted,#A0A0A0)] mt-1">
              {t('creatorSettings.navigation.description')}
            </p>
          </div>

          <ul className="divide-y divide-[var(--fc-border,#1F1F1F)]">
            {HIDEABLE_SIDEBAR_SECTIONS.map((section) => {
              const hidden = (selectedCommunity.sidebar_hidden_sections ?? []).includes(section);
              const visible = !hidden;
              const isSaving = savingNav === section;
              return (
                <li key={section} className="flex items-center gap-3 py-3">
                  <span className="text-[var(--fc-muted,#A0A0A0)]">{SECTION_ICON_MAP[section]}</span>
                  <span className="flex-1 text-sm text-[var(--fc-text,#FAFAFA)]">
                    {t(`creatorSettings.navigation.sections.${section}`)}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={visible}
                    disabled={isSaving}
                    onClick={() => toggleSectionVisibility(section, !visible)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors
                      ${visible ? 'bg-[var(--fc-accent,#7C3AED)]' : 'bg-[var(--fc-border,#333333)]'}
                      ${isSaving ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform
                        ${visible ? 'translate-x-5' : 'translate-x-1'}`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="text-xs text-[var(--fc-muted,#666666)] mt-4">
            {t('creatorSettings.navigation.helper')}
          </p>

          {navError && (
            <p className="text-xs text-[#EF4444] mt-2">{navError}</p>
          )}
        </section>
      )}
```

- [ ] **Step 5: Type-check passes**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/CreatorSettings.tsx
git commit -m "feat(settings): add Navigation section to CreatorSettings"
```

---

## Task 8: Verify on production (per user preference: no localhost)

Per user preference in memory, test on the production Vercel URL, not localhost. Founders Club auto-deploys `main` to https://founderclub.bg.

- [ ] **Step 1: Push branch and open PR or merge to main**

```bash
git push origin HEAD
```

Wait for Vercel deploy to finish (typically 1–2 min). Get the preview URL from Vercel dashboard or the git push output.

- [ ] **Step 2: Manual verification as a creator**

On the deployed URL:
1. Log in as a creator of a community.
2. Navigate to Settings → Създател → Навигация / Меню.
3. Verify the 8 toggles render with correct Bulgarian labels and icons.
4. Toggle "Домашни" OFF. The sidebar should immediately show "Домашни" with reduced opacity and the `EyeOff` badge.
5. Hover the sidebar item — tooltip reads "Скрита за членове".
6. Click it — still navigates to `/homework` normally (creator access preserved).
7. Reload the page — state persists.

- [ ] **Step 3: Manual verification as a member**

Log in as a non-creator member of the same community (different browser profile or incognito):
1. Sidebar should NOT show "Домашни".
2. Manually navigate to `/homework` — should redirect to `/dashboard`.

- [ ] **Step 4: Verification as creator — other communities unaffected**

Switch to a different community via `CommunitySwitcher`. The `sidebar_hidden_sections` change in the first community should have no effect here.

- [ ] **Step 5: Restore the toggle, confirm cleanup**

Toggle "Домашни" back ON. Confirm the sidebar item returns to normal opacity for the creator and reappears for members (after they reload).

- [ ] **Step 6: Commit any tweaks discovered during manual QA; otherwise note verification in the PR description**

---

## Self-Review Notes

- **Spec coverage:** DB column (T1), types (T2), service (T3), sidebar filter + creator badge (T4), route guard (T5), i18n (T6), CreatorSettings UI with auto-save (T7), production verification (T8). All spec sections covered.
- **Placeholder scan:** No TBD / TODO / "add error handling" left. Error handling in T7 is concrete (`navError` state + i18n message). One conditional branch in T7 ("If `useCommunity()` does not expose `setSelectedCommunity`…") is a necessary decision point because I haven't read `CommunityContext.tsx` — the engineer must inspect it; the fallback is explicit.
- **Type consistency:** `HideableSidebarSection` and `HIDEABLE_SIDEBAR_SECTIONS` defined in T3 and reused in T7 with matching names. View ID casing (`DASHBOARD`, `homework`, `ai_chat`, etc.) matches `View` enum in `src/core/types.ts:1-16`. Sidebar uses `item.id` as the key compared against `sidebar_hidden_sections`, which matches what T7 writes to the DB.
- **Not unit-tested:** project has Playwright E2E only, no unit test harness. Adding Vitest scaffolding for one feature would be scope creep; T8 covers behavior verification end-to-end on production (matching project convention per CLAUDE.md "Test changes there, not localhost").
