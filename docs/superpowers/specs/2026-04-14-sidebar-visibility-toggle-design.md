# Sidebar Visibility Toggle (per-community)

**Date:** 2026-04-14
**Status:** Design approved, pending implementation plan

## Problem

Creators want to hide sidebar sections that are not relevant to their specific community (e.g., a community focused on email marketing may not need Домашни or Събития). Today the sidebar is a fixed list for all members of all communities.

## Scope

Per-community toggle. Each creator configures visibility for their own community independently. Applies only to members/students — creators always see all sections, with visual markers on the ones hidden from members.

## Data Model

New column on `communities`:

```sql
ALTER TABLE communities
ADD COLUMN sidebar_hidden_sections text[] NOT NULL DEFAULT '{}';
```

Stores View keys that are **hidden from members**. Empty array = all visible (current behavior). Array approach (vs one boolean per section) is easier to extend without future migrations.

**Allowed values:** `dashboard`, `community`, `courses`, `homework`, `messages`, `ai_chat`, `calendar`, `ai_manager`.

**Not hideable:** Settings, Logout, creator-only items (Student Manager, Surveys, Discounts), Shop (already gated by `shop_enabled`).

## RLS

Existing `communities` update policy already restricts writes to the owner/creator. No new policy needed — just confirm during implementation that the update path flows through that policy.

## UI — where it is controlled

**Location:** `Settings` → tab **"Създател"** (existing `src/features/settings/CreatorSettings.tsx`). Visible only to `role === 'creator' || 'superadmin'`.

**New section** inside `CreatorSettings`, rendered below the existing Payout Status section:

- Title: `t('creatorSettings.navigation.title')` → "Навигация / Меню"
- Description: "Избери кои секции да се показват на членовете на общността"
- List of 8 rows, one per hideable section. Each row:
  - Section icon (lucide, same as sidebar)
  - Section label (from existing `sidebar.*` i18n keys)
  - Toggle switch (ON = visible to members, OFF = hidden)
- Helper text below list: "Скритите секции остават видими за теб, маркирани с икона."

**Behavior:** auto-save on toggle change. Optimistic UI update; on error, revert and toast error. Success = silent or brief "Запазено" toast.

## Sidebar Rendering

In `src/shared/Sidebar.tsx`, `getNavItems()`:

```ts
const hidden = selectedCommunity?.sidebar_hidden_sections ?? [];
const isCreator = role === 'creator' || role === 'superadmin';

// After existing filtering logic:
return items.map(item => ({
  ...item,
  isHiddenFromMembers: hidden.includes(item.id),
})).filter(item => isCreator || !item.isHiddenFromMembers);
```

For creators, render hidden items with:
- Reduced opacity (e.g., `opacity-60`)
- Small `EyeOff` icon badge (lucide) next to the label
- Tooltip on hover: "Скрита за членове"
- Still clickable — navigates normally

Members simply don't see them.

## Redirect Guard

If the currently-active view becomes hidden (e.g., member is on `/homework` and creator toggles it off), redirect to `/dashboard`. Add this check in the main route/layout (where `currentView` is resolved). Only applies to non-creators.

## Shop Parity

`shop_enabled` stays as-is (separate boolean on `communities`, gates the Shop nav item). No migration needed — leave that column alone. Future cleanup can unify, but out of scope here.

## i18n Keys (both `bg.json` + `en.json`)

```
creatorSettings.navigation.title
creatorSettings.navigation.description
creatorSettings.navigation.helper
creatorSettings.navigation.hiddenTooltip
creatorSettings.navigation.saved
```

Section labels reuse existing `sidebar.*` keys.

## Out of Scope

- Per-user-role visibility (all members see the same visibility set)
- Reordering of sections
- Custom sections / adding new items
- Hiding Settings or Logout
