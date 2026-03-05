# Architecture

## Tech Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe (Checkout, Billing, Connect)
- **AI**: Gemini API (via `services/geminiService.ts`)
- **Hosting**: Vercel (auto-deploys from main branch)
- **Entry Point**: `index.tsx` → `App.tsx`

## Directory Structure
```
src/
├── core/                    # Core utilities and types
│   ├── types.ts             # TypeScript type definitions
│   └── supabase/            # Supabase client
├── features/                # Feature modules
│   ├── billing/             # Stripe billing system
│   │   ├── components/      # PlanCard, UpgradeModal, etc.
│   │   ├── hooks/           # usePlanLimits, useLimitCheck
│   │   ├── pages/           # BillingSettingsPage, OnboardingPage
│   │   ├── stripeService.ts # Client-side Stripe operations
│   │   └── stripeTypes.ts   # Billing type definitions
│   ├── courses/             # Course LMS feature
│   ├── community/           # Community Hub
│   ├── ai-manager/          # AI Success Manager
│   ├── settings/            # User/Creator settings
│   ├── student/             # Student-specific views
│   ├── team/                # Team member system
│   ├── direct-messages/     # DMs + team management
│   ├── chatbots/            # Community AI chatbots
│   └── ...
├── shared/                  # Reusable UI components (Avatar, Logo, Sidebar)
├── public-pages/            # Public routes (auth, invite, landing)
├── services/                # External API integrations
│   └── geminiService.ts     # AI integration
├── i18n/                    # Internationalization
│   └── locales/             # en.json, bg.json
└── App.tsx
```

## Key Patterns & Conventions
- **Feature modules**: Each feature in `src/features/` has components/, hooks/, pages/
- **Service layer**: External APIs accessed via services in `src/services/`
- **Edge Functions**: Supabase functions in `supabase/functions/` with shared code in `_shared/`
- **Types**: Centralized in `src/core/types.ts` and feature-specific type files
- **Shared components**: Reusable UI in `src/shared/` (Avatar, Sidebar, Logo)
- **i18n**: All user-facing text via `t('namespace.key')`. Default language: Bulgarian (bg)
- **Strict TypeScript**: Use `import type` for type-only imports

## Important Files
| File | Purpose |
|------|---------|
| `src/App.tsx` | Route definitions, AppLayout, role-based redirects |
| `src/features/billing/stripeService.ts` | Client-side Stripe Checkout/Portal |
| `supabase/functions/_shared/stripe.ts` | Server-side Stripe client |
| `src/features/courses/quizService.ts` | Quiz CRUD, submission, pass checking |
| `src/shared/Avatar.tsx` | Shared avatar with consistent defaults |
| `src/shared/Logo.tsx` | Logo with dark/light variants |
| `src/public-pages/auth/ProtectedRoute.tsx` | Role-based access control |
| `src/i18n/locales/en.json` / `bg.json` | Translation files |

## Key Components
- `Dashboard.tsx` - Main admin dashboard
- `CommunityHub.tsx` - Forum-style community with channels/posts
- `CourseLMS.tsx` - Learning management system
- `CalendarView.tsx` - Events and scheduling
- `AiSuccessManager.tsx` - AI-powered student tracking
- `Sidebar.tsx` - Navigation

## Core Features (MVP v1.0)
1. **Community Hub** - Forums, channels, posts, basic chat, paid communities
2. **Course LMS** - Courses → Modules → Lessons with progress tracking, quiz-based module unlock/drip
3. **AI Success Manager** - Risk scoring, student health monitoring
4. **Calendar & Events** - Group events, 1:1 booking
5. **Payments & Plans** - Stripe integration, subscriptions, Connect payouts

## Data Models
- User, CreatorProfile, Community, Course, Module, Lesson
- Enrollment, Membership, Event, Subscription/Plan
- Progress, Engagement, Task, AIConversation

## Routing & Role-Based Access
- **Role-aware routes**: `/dashboard` renders different content based on user role via `AppLayout.renderContent()`
- **Post-login redirect**: `getDefaultRedirectPath(role)` — creators → `/dashboard`, students → `/courses`
- **ProtectedRouteWrapper**: Auth check + optional role restriction
- **Don't over-restrict**: Avoid `allowedRoles` on routes if `AppLayout` already handles role-based content

## Profile ID vs User ID (CRITICAL)
- `profile.id` ≠ `profile.user_id` (≠ `auth.users.id`)
- ALL `creator_id`/`user_id` columns in public tables reference `profiles.id`, NOT `auth.users.id`
- `useAuth()` returns `{ user, profile, role }` — always use `profile.id` for DB operations
- Two service patterns: internal lookup (accepts `user.id`, does profile lookup) vs direct (expects `profile.id`)
- Prefer internal lookup pattern for new services (more robust)

## Team Members System
- **Database**: `community_team_members` table with `invite_token`, `invite_status`, `role`, `title`, `bio`
- **Roles**: `lecturer`, `assistant`, `guest_expert`
- **Key files**: `teamService.ts`, `dmService.ts`, `TeamDashboard.tsx`, `TeamSettingsTab.tsx`, `TeamInvitePage.tsx`
- **Known limitation**: Lecturers see student view in `CourseLMS.tsx` (only checks `role === 'creator'`)
