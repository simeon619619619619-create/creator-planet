# Onboarding UI/UX Redesign

## Overview

Redesign both student and creator onboarding flows to be more engaging, dynamic, and make better use of screen space while eliminating scrolling.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Engagement style | Visual polish + Interactive elements | Elevates experience without over-engineering |
| Visual identity | Distinct themes per role | Students: emerald/teal, Creators: indigo/purple |
| Layout approach | Split-screen with larger cards | Better screen utilization, no scrolling |
| Flow structure | Keep preview + summary, elevate them | Maintains existing flow, improves impact |

## Changes Summary

### 1. Question Screen Layout (Both Flows)

**From:** Centered narrow column (~max-w-2xl), cramped options
**To:** Split-screen layout

```
┌─────────────────────────────────────────────────────────┐
│ [Progress bar - full width, animated fill]              │
├───────────────────────┬─────────────────────────────────┤
│   Left Panel (40%)    │   Right Panel (60%)             │
│                       │                                 │
│   Question Title      │   Option Cards (2-col grid)     │
│   & Subtitle          │   ┌─────┐  ┌─────┐              │
│                       │   │  1  │  │  2  │              │
│   [Gradient orb]      │   └─────┘  └─────┘              │
│                       │   ┌─────┐  ┌─────┐              │
│   Question X of Y     │   │  3  │  │  4  │              │
│   [Back button]       │   └─────┘  └─────┘              │
│                       │                                 │
│                       │   [Continue button]             │
└───────────────────────┴─────────────────────────────────┘
```

**Key specs:**
- Left panel: 40% width, contains question text, progress, back button
- Right panel: 60% width, contains option cards in responsive 2-column grid
- Option cards: ~80px height, icon + label + description
- Mobile: Stacks vertically, maintains larger card sizes
- Background: Subtle animated gradient orbs

### 2. Animation System

**Question transitions:**
- Outgoing: Slide left + fade out (200ms ease-out)
- Incoming: Slide in from right + fade in (300ms ease-out, 50ms delay)

**Option card interactions:**
- Hover: `scale-[1.02]` + shadow lift + border color shift
- Select: Pulse animation (scale 1.05 → 1.0 over 150ms) + checkmark animates in
- Entrance: Staggered fade-in (50ms delay between cards)

**Progress bar:**
- Width transition: 500ms ease-out
- Subtle glow on leading edge

**Background orbs:**
- Slow floating animation (20s infinite)
- Gentle pulse on question change

### 3. Preview Screen Elevation

**Students (emerald/teal theme):**
- Dashboard mockup takes ~70% viewport height
- Animated entrance (scale up from 0.9)
- Stats animate with counting effect
- Headline: "Your personalized learning dashboard is ready"

**Creators (indigo/purple theme):**
- Creator dashboard mockup with revenue/student widgets
- Same animation treatment
- Headline: "Your creator command center is ready"

### 4. Summary Screen Elevation

**Layout:** Same split-screen as questions
- Left: Animated checkmarks, personalization message
- Right: Answer cards with topic-specific icons

**Answer cards display:**
- Interest with target icon
- Goal with chart icon
- Learning style with brain icon
- Each animates in with stagger

### 5. Color Themes

**Student Onboarding:**
```css
Background: from-emerald-900 via-teal-900 to-cyan-900
Accent: emerald-500, teal-500
Gradient orbs: emerald-600/10, cyan-600/10, teal-500/5
```

**Creator Onboarding:**
```css
Background: from-slate-900 via-indigo-950 to-purple-950
Accent: indigo-500, purple-500
Gradient orbs: indigo-600/10, purple-600/10
```

## Files to Modify

### Shared Component (Used by Both)
- `src/features/creator-onboarding/components/OnboardingQuestion.tsx` - Major rewrite for split-screen layout

### Student Onboarding
- `src/features/student-onboarding/pages/StudentOnboardingPage.tsx` - Minor flow updates
- `src/features/student-onboarding/components/StudentPreviewScreen.tsx` - Elevation with larger mockup
- `src/features/student-onboarding/components/StudentSummaryScreen.tsx` - Split-screen layout

### Creator Onboarding
- `src/features/creator-onboarding/pages/OnboardingPage.tsx` - Minor flow updates
- `src/features/creator-onboarding/components/PreviewScreen.tsx` - Creator dashboard mockup
- `src/features/creator-onboarding/components/SummaryScreen.tsx` - Split-screen layout (if exists)

### Translations
- `src/i18n/locales/en.json` - New copy for elevated headlines
- `src/i18n/locales/bg.json` - Bulgarian translations

## Implementation Order

1. **OnboardingQuestion.tsx** - Core split-screen layout + animations
2. **StudentPreviewScreen.tsx** - Enlarged mockup + animations
3. **StudentSummaryScreen.tsx** - Split-screen + answer cards
4. **Creator equivalents** - Apply same patterns with indigo/purple theme
5. **Translations** - Update both locale files

## Technical Notes

- Use Tailwind's built-in transitions (`transition-all duration-300`)
- Custom keyframes for pulse/entrance animations in component styles
- No external animation library required
- Mobile breakpoint: Stack vertically below `md:` (768px)
- Maintain keyboard navigation (1-9 keys, Enter, Escape)
