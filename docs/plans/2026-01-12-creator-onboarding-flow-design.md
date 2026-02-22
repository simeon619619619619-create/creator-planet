# Creator Onboarding Flow Design

**Date:** 2026-01-12
**Status:** Approved
**Author:** Claude + Bojo

## Overview

An interactive, Typeform-style onboarding flow for creators that collects information about their business before registration. The flow captures niche, current stage, pain points, goals, and preferences to enable personalization and provide product insights.

## Goals

1. **Qualification & Personalization** - Understand creators to customize their experience
2. **Lead Capture** - Gather information even if they don't complete signup
3. **Product-Market Fit Data** - Collect insights about creator segments and needs

## User Flow

```
Landing Page (/) ──────────────┐
    "Get Started" button       │
                               ▼
Discover Page (/discover) ────► /onboarding/creator
    "Create a business" button      │
    "Start building for free"       │
                                    ▼
                           ┌────────────────────┐
                           │  ONBOARDING FLOW   │
                           │  (7 questions)     │
                           │  Typeform-style    │
                           └────────────────────┘
                                    │
                                    ▼
                           ┌────────────────────┐
                           │  PREVIEW SCREEN    │
                           │  "Your Hub" mockup │
                           └────────────────────┘
                                    │
                                    ▼
                           ┌────────────────────┐
                           │  SUMMARY SCREEN    │
                           │  Personalized CTA  │
                           └────────────────────┘
                                    │
                                    ▼
                           ┌────────────────────┐
                           │  SIGNUP FORM       │
                           │  (embedded/inline) │
                           └────────────────────┘
                                    │
                                    ▼
                           ┌────────────────────┐
                           │  Link onboarding   │
                           │  data to profile   │
                           │  → /dashboard      │
                           └────────────────────┘
```

## The 7 Questions

| # | Question | Type | Options |
|---|----------|------|---------|
| 1 | What do you teach or coach? | Single select | Fitness & Health, Business & Marketing, Design & Creative, Tech & Development, Personal Development, Lifestyle & Hobbies, Other (free text) |
| 2 | Where are you in your creator journey? | Single select | Just getting started (idea stage), Side hustle (< €1K/mo), Going full-time (€1K-5K/mo), Established business (€5K+/mo) |
| 3 | How many students or followers do you have? | Single select | 0-100, 100-1,000, 1,000-10,000, 10,000+ |
| 4 | What's your biggest frustration right now? | Single select | Too many tools to manage, Losing students / high churn, No time - stuck doing admin, Tech overwhelm, Hard to track student progress, Other (free text) |
| 5 | What do you most want to achieve? | Single select | Launch my first course, Build an engaged community, Scale my existing business, Automate & save time, Increase student success rates |
| 6 | What tools are you currently using? | Multi-select | None yet, Discord, Kajabi/Teachable/Thinkific, Skool, Calendly/Cal.com, Circle, Notion, Other |
| 7 | What's your monthly revenue goal? | Single select | < €1K, €1K-5K, €5K-10K, €10K-25K, €25K+ |

## UX Design

### Question Screen (Typeform-style)
- Full-screen, single question at a time
- Smooth fade/slide transitions between questions
- Progress indicator (dots or thin bar)
- Keyboard navigation support (Enter to continue, number keys to select)
- Back button to revisit previous questions

### Preview Screen
After question 7, show a personalized mockup of their future dashboard:
- Dynamic title based on niche (e.g., "Your Fitness Coaching Hub")
- Mockup showing dashboard, community, courses sections
- Creates emotional connection and excitement

### Summary Screen
Personalized message based on their answers:
- Reflects their niche, goal, and pain point
- Highlights how Creator Club solves their specific problem
- Clear CTA: "Create your free account"
- Trust signals: "No credit card required"

### Inline Signup Form
- Embedded directly in the flow (not a redirect)
- Pre-filled with role="creator"
- Minimal fields: Name, Email, Password
- On success: sync onboarding data, redirect to /dashboard

## Data Storage

### localStorage Structure

```typescript
// Key: 'creator_onboarding_session'
{
  sessionId: "onb_abc123xyz",      // Unique ID generated at start
  startedAt: "2026-01-12T10:30:00Z",
  answers: {
    niche: "fitness",
    nicheOther: null,              // If "Other" selected
    stage: "side_hustle",
    audienceSize: "100_1000",
    painPoint: "too_many_tools",
    painPointOther: null,
    goal: "scale_business",
    currentTools: ["discord", "calendly"],
    revenueGoal: "5k_10k"
  },
  completedAt: "2026-01-12T10:35:00Z"
}
```

### Database Table

```sql
CREATE TABLE creator_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_id TEXT UNIQUE NOT NULL,
  niche TEXT,
  niche_other TEXT,
  stage TEXT,
  audience_size TEXT,
  pain_point TEXT,
  pain_point_other TEXT,
  goal TEXT,
  current_tools TEXT[],
  revenue_goal TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX idx_creator_onboarding_profile ON creator_onboarding(profile_id);
CREATE INDEX idx_creator_onboarding_session ON creator_onboarding(session_id);
```

### Data Flow

1. Generate `sessionId` when user starts onboarding
2. Store answers in localStorage as user progresses
3. On signup completion, read localStorage and call edge function
4. Edge function creates `creator_onboarding` record linked to new profile
5. Clear localStorage after successful sync

## File Structure

```
src/features/creator-onboarding/
├── pages/
│   └── CreatorOnboardingPage.tsx    # Main flow orchestrator
├── components/
│   ├── OnboardingQuestion.tsx       # Single question display
│   ├── OnboardingProgress.tsx       # Progress dots/bar
│   ├── PreviewScreen.tsx            # Dashboard mockup
│   ├── SummaryScreen.tsx            # Personalized value prop
│   └── InlineSignupForm.tsx         # Embedded signup at end
├── hooks/
│   └── useOnboardingSession.ts      # localStorage management
├── onboardingQuestions.ts           # Question config data
├── onboardingService.ts             # Sync to database
└── index.ts                         # Exports

supabase/
├── migrations/
│   └── XXX_creator_onboarding.sql   # New table
└── functions/
    └── sync-onboarding/             # Edge function to link data
        └── index.ts
```

## Route & Button Changes

### New Route (App.tsx)
```tsx
<Route path="/onboarding/creator" element={<CreatorOnboardingPage />} />
```

### Button Updates

**LandingPage.tsx:**
- Change `onGetStarted` callback to navigate to `/onboarding/creator`

**WhopLandingPage.tsx:**
- "Create a business" buttons → `/onboarding/creator`
- "Start building for free" button → `/onboarding/creator`

## Success Metrics

- Onboarding completion rate (target: 70%+)
- Signup conversion after onboarding completion
- Data completeness (% of fields filled)
- Niche/stage distribution insights

## Future Enhancements (Out of Scope)

- A/B testing different question orders
- Adaptive branching based on answers
- Email capture mid-flow for abandoned sessions
- Personalized dashboard setup based on onboarding data
