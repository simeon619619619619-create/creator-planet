# Content Categories Design

**Date:** 2026-03-11
**Status:** Approved

## Goal

Add a shared, predefined category system for courses and communities. Categories appear as a horizontal pill filter bar on both the root courses page (`/`) and the communities directory (`/communities`).

## Decisions

- **Shared** categories for both courses and communities
- **Predefined** via a Postgres enum (no creator-defined categories)
- **One category** per item (not multi-select)
- **Horizontal pill bar** UI on both public pages
- **Nullable** — existing items without a category show under "All" only

## Categories

| Enum Value | EN | BG |
|---|---|---|
| `marketing` | Marketing | Маркетинг |
| `business` | Business | Бизнес |
| `design` | Design | Дизайн |
| `video_photo` | Video & Photo | Видео & Фото |
| `personal_development` | Personal Development | Личностно развитие |
| `finance` | Finance | Финанси |
| `technology` | Technology | Технологии |
| `health_fitness` | Health & Fitness | Здраве & Фитнес |

## Database

```sql
CREATE TYPE public.content_category AS ENUM (
  'marketing', 'business', 'design', 'video_photo',
  'personal_development', 'finance', 'technology', 'health_fitness'
);

ALTER TABLE public.courses ADD COLUMN category public.content_category;
ALTER TABLE public.communities ADD COLUMN category public.content_category;
```

## Frontend

### Shared constant (`src/shared/constants/categories.ts`)

```typescript
export const CONTENT_CATEGORIES = [
  { value: 'marketing', labelKey: 'categories.marketing' },
  { value: 'business', labelKey: 'categories.business' },
  { value: 'design', labelKey: 'categories.design' },
  { value: 'video_photo', labelKey: 'categories.videoPhoto' },
  { value: 'personal_development', labelKey: 'categories.personalDevelopment' },
  { value: 'finance', labelKey: 'categories.finance' },
  { value: 'technology', labelKey: 'categories.technology' },
  { value: 'health_fitness', labelKey: 'categories.healthFitness' },
] as const;

export type ContentCategory = typeof CONTENT_CATEGORIES[number]['value'];
```

### CategoryFilter component

- Horizontal scrollable pill bar
- "All" selected by default
- Active pill gets green/accent fill
- Client-side filtering on fetched data
- Reused on both pages

### Creator forms

- Category dropdown added to course creation/edit form
- Category dropdown added to community settings form
- Optional field

## Files Changed

| File | Change |
|---|---|
| New migration `041_content_categories.sql` | Enum + columns |
| `src/shared/constants/categories.ts` | New shared constant |
| `src/shared/components/CategoryFilter.tsx` | New reusable pill bar |
| `en.json` + `bg.json` | Category translation keys |
| `LandingPage.tsx` | Replace hardcoded categories with CategoryFilter |
| `landingService.ts` | Remove `COURSE_CATEGORIES`, add `category` to select |
| `CommunitiesDirectory.tsx` | Add CategoryFilter |
| `communityService.ts` | Add `category` to select |
| Course create/edit form | Add category dropdown |
| Community settings form | Add category dropdown |
| `database.types.ts` | Add `category` field |
