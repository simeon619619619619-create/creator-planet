# Creator Club - Discovery Log

Implementation history and lessons learned. This file is referenced by CLAUDE.md but extracted to reduce context window usage.

---

## [2025-12-30 17:00] Billing System Complete Implementation
**Context**: Full Stripe billing infrastructure deployment

**Learnings**:
- Complete billing system with 3-tier pricing (Starter/Pro/Scale)
- Stripe Products created in live mode
- 6 Edge Functions deployed for payment flows
- Webhook configured and active (we_1Sk4MdFbO001Rr4nPMqOLW9x)
- Student Plus subscription system added for student-facing subscriptions

**Files Touched**:
- `supabase/migrations/011_billing_system.sql` - Core billing schema
- `supabase/migrations/012_billing_security.sql` - RLS policies
- `src/features/billing/*` - Complete billing UI
- `supabase/functions/stripe-*` - All Stripe Edge Functions

**Gotchas Discovered**:
- `@stripe/stripe-js` must be added as direct dependency (not just react-stripe-js)
- Edge Functions need explicit CORS headers for Stripe Elements
- Billing plans seeded via migration, not application code

---

## [2026-01-03 15:45] Community Member Count RLS Fix
**Context**: Community landing pages showing 0 members despite having active members posting

**Learnings**:
- RLS policies for `anon` role don't apply to `authenticated` users - need separate policies
- The `getCommunityMemberCount()` function in `communityService.ts` queries the `memberships` table
- Public community pages use `getCommunityPublicData()` which fetches member count, channels, and recent posts in parallel
- Existing policy `"Anon can view membership counts in public communities"` only worked for anonymous visitors

**Files Touched**:
- `supabase/migrations/fix_membership_count_rls.sql` - New migration adding authenticated policy
- `src/features/community/communityService.ts` - Member count query functions (lines 665-702)
- `src/public-pages/communities/CommunityLandingPage.tsx` - Displays member count in Community Stats

**Gotchas Discovered**:
- When debugging RLS issues, check `pg_policy` table directly: `SELECT polname, polroles::regrole[] FROM pg_policy WHERE polrelid = 'table_name'::regclass`
- Roles `{-}` in pg_policy means default (usually authenticated), `{anon}` or `{authenticated}` are specific roles
- Database had correct data (13 members), issue was purely RLS visibility

---

## [2026-01-03] Profile ID vs User ID Mismatch Fix (CRITICAL BUG)
**Context**: User Simeon619619619619@gmail.com couldn't create courses - getting RLS policy violations and permission errors

**Root Cause Investigation**:
- Discovered that `profile.id` (auto-generated UUID) is DIFFERENT from `profile.user_id` (auth.users.id FK)
- ALL `creator_id` and `user_id` columns in database tables reference `profiles.id`, not `auth.users.id`
- Bug was hidden because for some users (bojodanchev), these IDs happened to be identical by coincidence
- For Simeon, they differed: `profile.id = 3ba15897-...` vs `profile.user_id = ce8ccc0a-...`
- Code was using `user.id` from `useAuth()` when it should use `profile.id`

**Learnings**:
- `useAuth()` returns `{ user, profile, role }` - always use `profile.id` for DB operations
- Services have two patterns:
  1. Internal lookup (robust): Accept auth user.id, convert to profile.id internally (communityService.ts)
  2. Direct expectation: Expect profile.id passed in (courseService.ts, dashboardService.ts)
- Components must know which pattern each service uses
- RLS policies should use `get_my_profile_id()` function, not `auth.uid()`

**Files Fixed**:
- `src/features/courses/CourseLMS.tsx` - 6 `getCourseWithDetails` calls changed from `user?.id` to `profile?.id`
- `src/features/calendar/CalendarView.tsx` - All event service calls (loadEvents, createEvent, rsvp)
- `src/features/ai-manager/AiSuccessManager.tsx` - All dashboard/conversation service calls
- `src/features/dashboard/Dashboard.tsx` - Dashboard stats and at-risk student queries
- `src/features/dashboard/TasksPanel.tsx` - Task CRUD operations
- `src/features/community/pointsService.ts` - Added profile lookup to `getPointTransactions()`
- `src/features/billing/hooks/usePlanLimits.ts` - Plan tier and usage queries
- `src/features/settings/CreatorSettings.tsx` - Creator profile and Stripe Connect calls

**Gotchas Discovered**:
- When IDs happen to match by coincidence, bugs are invisible until a different user triggers them
- Comments like `// Use profile.id because X references profiles.id` were added throughout for future clarity
- Always verify ID types when debugging RLS errors - check both the code AND the database FK references

---

## [2026-01-03 17:30] Avatar Consistency Fix
**Context**: Profile images showing inconsistently across the app - sidebar, settings, and chat all used different defaults. Custom images rendered poorly in small circles.

**Root Cause Investigation**:
- **Issue 1 - Inconsistent defaults**: Three different fallback strategies existed:
  - Sidebar: `picsum.photos/seed/creator/40/40` (random photo)
  - ProfileSettings: `picsum.photos/seed/profile/100/100` (different random photo)
  - Community/Chat: `ui-avatars.com` with initials (consistent with user's name)
- **Issue 2 - Poor rendering**: Missing `object-cover` CSS on small circular avatars caused custom images to stretch/squeeze instead of cropping properly

**Learnings**:
- Use `ui-avatars.com` for default avatars - generates initials-based images that are personalized and consistent
- Format: `https://ui-avatars.com/api/?name={name}&background=6366f1&color=fff&size={px}&bold=true`
- Always add `object-cover` class to avatar `<img>` elements for proper cropping in circles
- Created shared `Avatar` component at `src/shared/Avatar.tsx` with:
  - Consistent ui-avatars.com fallback
  - Built-in `object-cover` styling
  - Size variants: xs (24px), sm (32px), md (40px), lg (64px), xl (96px)
  - Error handling with fallback to initials

**Files Touched**:
- `src/shared/Avatar.tsx` - **New** shared component
- `src/shared/Sidebar.tsx` - Now uses Avatar component
- `src/features/settings/ProfileSettings.tsx` - Updated fallback URL to ui-avatars.com
- `src/features/community/CommunityHub.tsx` - Added `object-cover` to 5 avatar instances (lines 737, 863, 1022, 1049, 1258)

**Gotchas Discovered**:
- No shared Avatar component existed - each file implemented avatar rendering independently
- `picsum.photos` returns different images for different seeds, so "creator" vs "profile" showed different photos
- ProfileSettings has custom upload overlay, so it keeps the `<img>` tag but uses consistent fallback URL

---

## [2026-01-03 16:15] Student Dashboard Route Fix
**Context**: Students logging in were redirected to `/dashboard` and shown "Access Denied" error instead of their student home page

**Root Cause Investigation**:
- `/dashboard` route had `allowedRoles={['creator', 'superadmin']}` restriction
- `AppLayout.renderContent()` already had logic to show `StudentHome` for students, `Dashboard` for creators
- But students were blocked by `ProtectedRouteWrapper` before ever reaching `AppLayout`
- Result: Students saw "Access Denied" with message "Required role: creator or superadmin, Your role: student"

**Learnings**:
- When `AppLayout` handles role-based content rendering, don't add `allowedRoles` to the route
- The pattern is: routes define what's protected (auth required), `AppLayout.renderContent()` decides what content to show
- `getDefaultRedirectPath(role)` correctly sent students to `/courses`, but direct navigation to `/dashboard` was broken

**Fix Applied**:
- Removed `allowedRoles={['creator', 'superadmin']}` from `/dashboard` route in App.tsx (line 320)
- Now students navigating to `/dashboard` see `StudentHome`, creators see `Dashboard`

**Files Touched**:
- `src/App.tsx` - Removed role restriction from `/dashboard` route

**Gotchas Discovered**:
- Same URL can show different content based on role - this is intentional and handled by `AppLayout`
- Don't confuse "route protection" (requires auth) with "content switching" (same route, different component)

---

## [2026-01-03] Edge Function 401 Authentication Fix (RESOLVED)
**Context**: Payment E2E testing revealed all Edge Functions return 401 "Invalid or missing authentication token" while REST API calls succeed with the same authenticated session

**Root Cause**:
The `getUserFromToken()` function in `supabase/functions/_shared/supabase.ts` was calling `client.auth.getUser()` WITHOUT passing the JWT token explicitly. Per [Supabase Edge Function auth docs](https://supabase.com/docs/guides/functions/auth), you MUST extract the token from the Authorization header and pass it to `getUser(token)`.

**Original broken code**:
```typescript
const { data: { user }, error } = await client.auth.getUser(); // Wrong
```

**Fixed code**:
```typescript
const token = authHeader.replace('Bearer ', '');
const { data: { user }, error } = await client.auth.getUser(token); // Correct
```

**Files Fixed**:
- `supabase/functions/_shared/supabase.ts:57-87` - `getUserFromToken()` now extracts and passes token explicitly

**Edge Functions Redeployed**:
- `stripe-connect` (v3)
- `stripe-checkout` (v3)

**Gotchas Discovered**:
- Supabase Edge Functions don't auto-populate user from session like the browser client does
- Must explicitly extract JWT from `Authorization: Bearer <token>` header
- Must pass token to `getUser(token)` - the no-argument `getUser()` returns null in Edge Functions

---

## [2026-01-03] Stripe Connect Setup Required for Payouts
**Context**: After fixing 401, Edge Functions returned 500 with error "You can only create new accounts if you've signed up for Connect"

**Root Cause**:
Stripe Connect must be enabled in the Stripe Dashboard before creating Express accounts for creators.

**Setup Steps**:
1. Go to: https://dashboard.stripe.com/connect/accounts
2. Click "Get started with Connect"
3. Select "Onboarding hosted by Stripe" (Express accounts)
4. Complete platform profile
5. **Verify identity** (required for live mode)
6. Confirm final details

**Business Model Reference**:
| Party | Pays | Amount | When |
|-------|------|--------|------|
| Creator | Activation fee | €2.90 | Once, at registration |
| Creator | Monthly fee | €0/€30/€99 | After first sale (Starter/Pro/Scale) |
| Student | Product price | Varies | On purchase |
| Platform | Takes fee | 6.9%/3.9%/1.9% | From each sale |

**Money Flow** (student buys €100 course from Pro creator):
```
Student pays €100
├── Stripe processing: ~€3
├── Platform fee (3.9%): €3.90
└── Creator receives: €93.10 (via Connect payout)
```

**Why Connect is Required**:
- Enables split payments (automatic platform fee deduction)
- Each creator gets their own Stripe Express account for payouts
- Handles tax reporting (1099s) for creators
- Without Connect, you'd manually transfer money to each creator

**Key Files**:
- `supabase/functions/stripe-connect/index.ts` - Creates Express accounts, generates onboarding links
- `supabase/functions/_shared/stripe.ts:42-68` - STRIPE_CONFIG with product/price IDs
- `docs/plans/2025-12-29-billing-system-design.md` - Complete billing architecture

**Test vs Live Mode**:
- Current config uses LIVE mode product IDs (`prod_ThBh...`, `price_1Sjn...`)
- Products, prices, webhooks, and Connect accounts are separate between modes
- To use test mode: switch keys, recreate products, update database

---

## [2026-01-03] Community Monetization Implementation
**Context**: Implementing paid community access - creators can set pricing (free/one-time/monthly), students purchase access on landing page, payments split via Stripe Connect

**Architecture**:
- **Database**: Added pricing columns to `communities` table, payment tracking to `memberships`, new `community_purchases` table
- **Edge Functions**: `community-checkout` creates Stripe Checkout sessions, `stripe-webhook` handles payment completion
- **Frontend**: `CommunityPricingSettings` for creators, updated `JoinButton` and `CommunityLandingPage` for students

**Database Schema Changes** (migration `013_community_monetization.sql`):
```sql
-- Communities table additions
ALTER TABLE public.communities
ADD COLUMN pricing_type community_pricing_type DEFAULT 'free' NOT NULL,
ADD COLUMN price_cents INTEGER DEFAULT 0,
ADD COLUMN currency TEXT DEFAULT 'EUR',
ADD COLUMN stripe_product_id TEXT,
ADD COLUMN stripe_price_id TEXT;

-- Memberships payment tracking
ALTER TABLE public.memberships
ADD COLUMN payment_status TEXT DEFAULT 'none',
ADD COLUMN stripe_subscription_id TEXT,
ADD COLUMN stripe_payment_intent_id TEXT,
ADD COLUMN paid_at TIMESTAMPTZ,
ADD COLUMN expires_at TIMESTAMPTZ;
```

**Payment Flow**:
1. Student clicks "Join" on paid community landing page
2. `JoinButton` calls `communityPaymentService.createCommunityCheckout()`
3. Edge Function creates pending membership + Stripe Checkout session
4. Student completes payment on Stripe-hosted checkout
5. Webhook `checkout.session.completed` updates membership to `paid`, records sale

**Key Files Created/Modified**:
- `supabase/functions/community-checkout/index.ts` - Creates Checkout sessions with Connect application fees
- `supabase/functions/stripe-webhook/index.ts` - Added `handleCommunityCheckoutComplete()`, subscription handlers
- `src/features/community/communityTypes.ts` - TypeScript types for community monetization
- `src/features/community/communityPaymentService.ts` - Client-side payment operations
- `src/features/community/components/CommunityPricingSettings.tsx` - Creator pricing UI
- `src/public-pages/communities/JoinButton.tsx` - Payment flow integration
- `src/public-pages/communities/CommunityLandingPage.tsx` - Pricing display cards
- `src/core/types.ts` - Added pricing fields to `CommunityPublicData`

**Platform Fee Calculation**:
```typescript
// Fee based on creator's plan tier
const feePercent = creatorBilling?.plan?.platform_fee_percent || 6.9;
const platformFee = Math.round(community.price_cents * (feePercent / 100));

// Stripe Connect application_fee_amount for split
application_fee_amount: platformFee,
transfer_data: { destination: creatorStripeAccountId }
```

**Webhook Handlers Added**:
- `handleCommunityCheckoutComplete()` - Updates membership to paid, creates `creator_sales` record
- `handleCommunitySubscriptionUpdated()` - Renews access on subscription renewal
- `handleCommunitySubscriptionDeleted()` - Marks membership as canceled

**Gotchas Discovered**:
- Stripe products/prices created dynamically per community (no pre-configured products)
- Pending membership created BEFORE checkout - allows tracking even if checkout is abandoned
- MCP Edge Function deployment requires inlining all `../_shared/` imports
- `CommunityPublicData` type needed updating to include `pricing_type`, `price_cents`, `currency`
- Both `community-checkout` and `stripe-webhook` need `verify_jwt: false` (Stripe calls don't have JWT)

---

## [2026-01-04] Quiz-Based Module Unlock System Implementation
**Context**: Implementing a quiz-based drip/unlock system where creators can create quizzes that students must pass before proceeding to the next module

**Architecture Decisions**:
- **Quiz as lesson type**: Quizzes are a lesson type (`type = 'quiz'`), reusing existing lesson infrastructure rather than separate entity
- **Multiple choice only**: 2-4 options per question, single correct answer
- **Fixed 70% passing threshold**: PASSING_THRESHOLD constant in QuizPlayer.tsx
- **Unlimited retries**: Questions shuffle each attempt via Fisher-Yates algorithm
- **Module unlock gating**: Modules can require passing a quiz from the PREVIOUS module

**Database Schema** (migration `015_quiz_system.sql`):
```sql
-- Quiz questions linked to lessons
CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Answer options for each question
CREATE TABLE public.quiz_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT false,
  position INTEGER DEFAULT 0
);

-- Student attempt history
CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  score_percent INTEGER NOT NULL CHECK (score_percent >= 0 AND score_percent <= 100),
  passed BOOLEAN NOT NULL,
  answers JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ DEFAULT now()
);

-- Extended unlock_type enum
ALTER TYPE unlock_type ADD VALUE IF NOT EXISTS 'quiz';
```

**Key Files Created**:
| File | Purpose |
|------|---------|
| `src/features/courses/quizService.ts` | Quiz CRUD, submission, pass checking |
| `src/features/courses/components/QuizBuilder.tsx` | Creator UI for building quizzes |
| `src/features/courses/components/QuizPlayer.tsx` | Student quiz-taking experience |
| `docs/plans/2026-01-04-quiz-unlock-system-design.md` | Complete design document |

**Key Files Modified**:
| File | Changes |
|------|---------|
| `src/core/supabase/database.types.ts` | Added `'quiz'` to UnlockType, DbQuizQuestion/Option/Attempt types |
| `src/features/courses/courseService.ts` | Added `isModuleUnlocked()`, `getModulesUnlockStatus()` |
| `src/features/courses/components/LessonEditModal.tsx` | Integrated QuizBuilder for quiz lesson type |
| `src/features/courses/components/ModuleEditModal.tsx` | Added Quiz unlock condition with quiz selector |

**Quiz Builder Features**:
- Up to 20 questions per quiz (MAX_QUESTIONS)
- 2-4 options per question (MIN_OPTIONS, MAX_OPTIONS)
- Visual correct answer selection (green checkmark)
- Question/option position ordering
- Validation before save (empty fields, missing correct answer)

**Quiz Player States**:
```typescript
type QuizState = 'loading' | 'intro' | 'playing' | 'submitting' | 'results';
```
- Intro: Shows question count, pass threshold, best score
- Playing: Question navigation dots, answer selection, progress bar
- Results: Score display, answer review with correct/incorrect marking

**Module Unlock Logic** (`courseService.ts:isModuleUnlocked`):
```typescript
switch (module.unlock_type) {
  case 'immediate': return true;
  case 'date': return new Date() >= new Date(module.unlock_value);
  case 'progress': // Check previous module completion percentage
  case 'quiz': return hasPassedQuiz(module.unlock_value, userId);
  default: return true;
}
```

**RLS Policies**:
- Quiz questions/options: Creators can manage their own, students can read for enrolled courses
- Quiz attempts: Users can only see/create their own attempts
- Helper function `is_enrolled_student(lesson_id, user_id)` for enrollment check

**Gotchas Discovered**:
- `DbModule` interface was missing `thumbnail_url` field - caused TypeScript errors in ModuleEditModal
- Quiz unlock button disabled for first module (no previous module to have quizzes)
- `getQuizLessonsInModule()` queries lessons with `type = 'quiz'` from previous module for the unlock selector
- Fisher-Yates shuffle runs on each quiz start via `useMemo` with state dependency
- Answer storage in attempts uses JSONB: `{ question_id: selected_option_id }`

---

## [2026-01-06] Logo Component Implementation
**Context**: Switching from inline "C" icon boxes to actual logo images across all screens

**Architecture Decisions**:
- Created shared `Logo` component at `src/shared/Logo.tsx`
- Logo 2 (bold black "C" with play button) selected over Logo 1 (lighter gray)
- Single logo file at `public/logo.png` with CSS filter for light/dark variants
- `variant="light"` uses `filter: brightness(0) invert(1)` to create white logo for dark backgrounds

**Logo Component API**:
```typescript
interface LogoProps {
  variant?: 'light' | 'dark';  // light = white (for dark bg), dark = black (for light bg)
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';  // 24px, 32px, 40px, 56px, 72px
  showText?: boolean;  // Show "Creator Club" text
  showTagline?: boolean;  // Show "COURSES & COMMUNITIES"
}
```

**Files Created**:
- `public/logo.png` - Main logo image (Logo 2)
- `src/shared/Logo.tsx` - Reusable Logo component with `Logo` and `LogoIcon` exports

**Files Updated** (13 locations):
| File | Background | Variant Used |
|------|------------|--------------|
| `src/shared/Sidebar.tsx:80` | Dark (slate-900) | `light` |
| `src/public-pages/auth/LoginForm.tsx:70` | Light (white card) | `dark` |
| `src/public-pages/auth/SignupForm.tsx:94` | Light (white card) | `dark` |
| `src/public-pages/communities/PublicNavigation.tsx:18` | Light (white) | `dark` |
| `src/features/landing/LandingPage.tsx:103` | Light header | `dark` |
| `src/features/landing/LandingPage.tsx:356` | Dark footer | `light` |
| `src/public-pages/LandingPage.tsx:34` | Light nav | `dark` |
| `src/public-pages/LandingPage.tsx:551` | Dark footer | `light` |
| `src/public-pages/MarketingLandingPage.tsx:335` | Light glass nav | `dark` |
| `src/public-pages/MarketingLandingPage.tsx:1108` | Dark footer | `light` |
| `src/public-pages/WhopLandingPage.tsx:317` | Dark nav | `light` |
| `src/public-pages/WhopLandingPage.tsx:376` | Dark hero | `light` |
| `src/public-pages/WhopLandingPage.tsx:550` | Dark footer | `light` |

**Gotchas Discovered**:
- Vite serves files from `public/` folder at root path (e.g., `/logo.png`)
- CSS `filter: brightness(0) invert(1)` effectively inverts black to white
- Previous inline logos used gradient backgrounds with "C" text - not actual logo images
- `Sparkles` icon was removed from PublicNavigation.tsx import (no longer needed)
- Removed unused imports: `Rocket`, `Award` from MarketingLandingPage; `Zap` from WhopLandingPage

---

## [2026-01-15] Creator Balance & Payout System Implementation
**Context**: Building a wallet-style balance system where platform collects 100% of payments, tracks creator balances, and processes weekly payouts via Stripe Connect.

**Architecture Decisions**:
- **Wallet model over instant splits**: Platform collects everything, tracks in DB, pays out weekly
- **7-day pending period**: All earnings held before becoming available (chargeback protection)
- **120-day rolling reserve**: 10% held for new creators, released over time
- **Chargeback protection**: Deduction order is available → reserved → negative balance
- **€50 minimum withdrawal** with 72-hour cooldown
- **Weekly automatic payouts** (Friday 9 AM UTC) + manual withdrawals

**Database Schema** (migration `026_balance_system.sql`):
```sql
-- New columns on creator_billing
ALTER TABLE public.creator_billing ADD COLUMN
  pending_balance_cents INTEGER NOT NULL DEFAULT 0,
  available_balance_cents INTEGER NOT NULL DEFAULT 0,
  reserved_balance_cents INTEGER NOT NULL DEFAULT 0,
  negative_balance_cents INTEGER NOT NULL DEFAULT 0,
  total_earned_cents INTEGER NOT NULL DEFAULT 0,
  total_paid_out_cents INTEGER NOT NULL DEFAULT 0,
  last_payout_at TIMESTAMPTZ;

-- New tables
CREATE TABLE pending_balances (
  id UUID PRIMARY KEY, creator_id UUID, sale_id UUID,
  amount_cents INTEGER, release_at TIMESTAMPTZ, status TEXT
);

CREATE TABLE balance_transactions (
  id UUID PRIMARY KEY, creator_id UUID,
  type TEXT, -- 'credit', 'debit', 'adjustment', 'chargeback', 'reserve_release'
  amount_cents INTEGER, balance_after_cents INTEGER, description TEXT
);

CREATE TABLE payouts (
  id UUID PRIMARY KEY, creator_id UUID,
  amount_cents INTEGER, stripe_transfer_id TEXT, status TEXT
);

CREATE TABLE reserve_releases (
  id UUID PRIMARY KEY, creator_id UUID,
  amount_cents INTEGER, release_at TIMESTAMPTZ, status TEXT
);
```

**Edge Functions Deployed**:
| Function | Purpose | Auth |
|----------|---------|------|
| `release-pending-balances` | Cron: move 7-day old pending → available | CRON_SECRET |
| `creator-withdrawal` | Manual withdrawal API (status, withdraw actions) | JWT |
| `process-payouts` | Cron: weekly automatic batch payouts | CRON_SECRET |
| `stripe-webhook` (v9) | Added dispute handlers for chargebacks | Stripe signature |

**Webhook Handlers Added**:
- `handleDisputeCreated()`: Deducts disputed amount (available → reserved → negative)
- `handleDisputeClosed()`: Refunds if won, logs if lost

**UI Components Created**:
- `src/features/billing/components/BalanceCard.tsx` - Dashboard balance display
- `src/features/billing/components/WithdrawalModal.tsx` - Manual withdrawal flow
- `src/features/billing/components/PayoutHistory.tsx` - Payout transaction list

**GitHub Actions Cron** (`.github/workflows/balance-crons.yml`):
```yaml
on:
  schedule:
    - cron: '0 6 * * *'    # Daily - release pending balances
    - cron: '0 9 * * 5'    # Friday - process payouts
  workflow_dispatch:       # Manual trigger with job selection
```

**Environment Variables Set**:
- Supabase: `CRON_SECRET` (via `npx supabase secrets set`)
- GitHub: `CRON_SECRET` (via `gh secret set`)

**Key Files Created/Modified**:
| File | Purpose |
|------|---------|
| `supabase/migrations/026_balance_system.sql` | Database schema |
| `supabase/functions/release-pending-balances/index.ts` | Daily cron function |
| `supabase/functions/creator-withdrawal/index.ts` | Manual withdrawal API |
| `supabase/functions/process-payouts/index.ts` | Weekly payout processor |
| `supabase/functions/stripe-webhook/index.ts` | Added dispute handlers |
| `.github/workflows/balance-crons.yml` | GitHub Actions cron |
| `src/features/billing/components/BalanceCard.tsx` | Balance UI |
| `src/features/billing/components/WithdrawalModal.tsx` | Withdrawal UI |
| `src/features/billing/components/PayoutHistory.tsx` | History UI |
| `src/features/billing/stripeService.ts` | Client-side balance/withdrawal calls |

**Gotchas Discovered**:
- **MCP deployment limitation**: Supabase MCP `deploy_edge_function` doesn't resolve `../_shared/` imports - must inline all dependencies
- **Supabase CLI auth**: If `supabase secrets set` fails with "Unauthorized", use `npx supabase secrets set` instead
- **Vercel Cron requires Pro**: Free tier cannot use `vercel.json` cron - use GitHub Actions instead
- **INTEGER cents everywhere**: €50 = 5000 cents, never use floats for money
- **profiles.id for creator_id**: All balance tables reference `profiles.id`, not `auth.users.id`

---

## [2026-01-24] Team Member System Review & Pending Invite UX Improvements
**Context**: Improving UX for pending team invitations and reviewing the complete team member journey after accepting an invite link

**Pending Invite UX Improvements**:
Enhanced `PendingInviteRow` component in `TeamSettingsTab.tsx` to show:
- Role badge with badge type (team/guest)
- Title and bio if provided during invite creation
- Copy link button with visual feedback (checkmark + "Copied!" state)
- Expiration countdown with color coding:
  - Green (4+ days): `bg-emerald-50 text-emerald-600`
  - Amber (2-3 days): `bg-amber-50 text-amber-600`
  - Red (1 day or expired): `bg-red-50 text-red-600`
- "Messageable" indicator if DMs enabled

**Team Member Journey Review** (all working correctly):
1. **Invite Acceptance** (`TeamInvitePage.tsx`): Token validation, community info display, role badge
2. **Dashboard** (`TeamDashboard.tsx`): Messages with unread count, courses (lecturers), events, profile
3. **Community Access**: Auto-selected team community, can post in channels, see team section
4. **DM Functionality**: `ChatPanel` with `viewMode='inbox'`, real-time subscriptions
5. **Profile Display** (`TeamProfilePage.tsx`): Full profile with avatar, badge, courses, message button

**Files Modified**:
| File | Changes |
|------|---------|
| `src/features/direct-messages/pages/TeamSettingsTab.tsx` | Enhanced `PendingInviteRow` with copy link, expiration, role display |
| `src/i18n/locales/en.json` | Added `copyLink`, `copied`, `expiresIn_one/other`, `expired` keys |
| `src/i18n/locales/bg.json` | Added Bulgarian translations for new keys |

**Gotchas Discovered**:
- **i18next v21+ pluralization**: Use `_one`/`_other` suffixes, NOT `_plural`. Example: `expiresIn_one`, `expiresIn_other`
- **Silent refresh pattern**: When refreshing data after modal success, pass `silent: true` to prevent unmounting the modal before success state displays
- **CourseLMS lecturer gap**: `CourseLMS.tsx` only grants creator UI to `role === 'creator'`. Lecturers (who have `role === 'member'`) see student view. TeamDashboard shows their courses but they can't edit via main Courses page. Intentionally not fixed yet.
- **Two `isTeamMember` functions exist**:
  - `teamService.ts`: Returns `boolean`
  - `dmService.ts`: Returns `DbCommunityTeamMember | null` (this one is used by CommunityHub)
