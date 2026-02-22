# Creator Club™ - Project Context

## Overview
Creator Club™ is an all-in-one platform/OS for mentors, coaches, and course creators. It replaces 4-5 separate tools (Discord, Kajabi, Calendly, Skool, Zapier, Whop) and adds an AI Success Manager that tracks student progress.

## Tech Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe (Checkout, Billing, Connect)
- **AI**: Gemini API (via `services/geminiService.ts`)
- **Entry Point**: `index.tsx` → `App.tsx`

## Quick Start
```bash
npm install        # Install dependencies
npm run dev        # Start dev server (Vite)
npm run build      # Production build
npm run preview    # Preview production build
```

## Deployment & Testing
- **Production URL**: https://creatorclub.bg (custom domain)
- **Vercel URL**: https://creator-club.vercel.app (original Vercel deployment)
- **Hosting**: Vercel (auto-deploys from main branch)
- **Testing**: Use the production URL (creatorclub.bg) for Playwright/browser testing, NOT localhost

## MCP Configuration

### Available Servers
From `.mcp.json`:
- **supabase**: HTTP MCP server for database operations
  - Project: `znqesarsluytxhuiwfkt`
  - URL: `https://mcp.supabase.com/mcp?project_ref=znqesarsluytxhuiwfkt`
- **stripe**: HTTP MCP server for payment operations (KINGDOM LTD business account)
  - URL: `https://mcp.stripe.com/`
  - Account: `acct_1SoV6VEHrm7Q2JIn` (KINGDOM LTD)
  - Use: `mcp__stripe__*` tools

### Key Tools & Their Uses
| Server | Tool | Purpose |
|--------|------|---------|
| supabase | `list_tables`, `execute_sql` | Database queries |
| supabase | `apply_migration` | Schema changes |
| supabase | `list_edge_functions`, `deploy_edge_function` | Serverless functions |
| stripe | `list_products`, `list_prices` | View Stripe catalog |
| stripe | `list_customers`, `list_subscriptions` | Customer data |
| stripe | `search_stripe_documentation` | API reference |

## Stripe Configuration

### Business Account: KINGDOM LTD
- **Account ID**: `acct_1SoV6VEHrm7Q2JIn`
- **Mode**: Live only (single account, no test mode)
- **Connect**: Express accounts enabled

### Product & Price IDs

| Product | Product ID | Price ID |
|---------|------------|----------|
| **Activation Fee** (€9.90 one-time) | `prod_Tm3yvErLQFwjjM` | `price_1Sput3EHrm7Q2JInE9dmsu4c` |
| **Pro Plan** (€30/mo) | `prod_Tm3yo6o2IkxEjW` | `price_1SoVqmEHrm7Q2JIncZnyu9SY` |
| **Scale Plan** (€99/mo) | `prod_Tm3yyZw4qEQRGI` | `price_1SoVqmEHrm7Q2JInneH7wG9d` |
| **Student Plus** (€9.90/mo) | `prod_Tm3yaCvF6DUXMN` | `price_1SoVqnEHrm7Q2JInAADYSo3z` |

### Webhook Configuration
- **Endpoint**: `https://znqesarsluytxhuiwfkt.supabase.co/functions/v1/stripe-webhook`
- **Webhook ID**: `we_1SoVv0EHrm7Q2JInLHDQ0GSl`
- **Events**: checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.*, account.updated, charge.dispute.created, charge.dispute.closed

### Environment Variables
```bash
# Supabase Edge Functions (secrets)
STRIPE_SECRET_KEY=sk_live_51SoV6VEHrm7Q2JIn...
STRIPE_WEBHOOK_SECRET=whsec_qIngTZOqYaH4wMpNs1MSpaQa06OaSpst
CRON_SECRET=<secure_random_string>  # Authenticates GitHub Actions cron calls

# Vercel Frontend
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_51SoV6VEHrm7Q2JIn...

# GitHub Actions (repository secrets)
CRON_SECRET=<same_as_supabase>  # Must match Supabase secret
```

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

## Data Models (from spec)
- User, CreatorProfile, Community, Course, Module, Lesson
- Enrollment, Membership, Event, Subscription/Plan
- Progress, Engagement, Task, AIConversation

## Architecture

### Directory Structure
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
│   └── ...
├── services/                # External API integrations
│   └── geminiService.ts     # AI integration
└── App.tsx
```

### Key Patterns & Conventions
- **Feature modules**: Each feature in `src/features/` has components/, hooks/, pages/
- **Service layer**: External APIs accessed via services in `src/services/`
- **Edge Functions**: Supabase functions in `supabase/functions/` with shared code in `_shared/`
- **Types**: Centralized in `src/core/types.ts` and feature-specific type files
- **Shared components**: Reusable UI components in `src/shared/` (Avatar, Sidebar, etc.)

### Important Files
| File | Purpose |
|------|---------|
| `src/features/billing/stripeService.ts` | Client-side Stripe Checkout/Portal |
| `supabase/functions/_shared/stripe.ts` | Server-side Stripe client |
| `docs/plans/2025-12-29-billing-system-design.md` | Complete billing architecture |
| `src/shared/Avatar.tsx` | Shared avatar component with consistent defaults |
| `src/shared/Logo.tsx` | Shared logo component with dark/light variants |
| `public/logo.png` | Main logo image (Logo 2 - black with play button) |
| `src/features/courses/quizService.ts` | Quiz CRUD, submission, pass checking |
| `src/features/courses/components/QuizBuilder.tsx` | Creator quiz editing UI |
| `src/features/courses/components/QuizPlayer.tsx` | Student quiz-taking experience |

## Billing System

### Architecture
The billing system uses a hybrid pricing model with:
- **Fixed monthly fee** (starts after first sale for Pro/Scale)
- **Percentage-based platform fee** on all sales
- **One-time activation fee** (€9.90) on registration (exclusive plan exempt)

### Creator Plans
| Plan | Monthly Fee | Platform Fee | Features |
|------|-------------|--------------|----------|
| Starter | €0 | 6.9% | 50 students, 2 courses, 1 community |
| Pro | €30 | 3.9% | 500 students, 10 courses, 3 communities |
| Scale | €99 | 1.9% | Unlimited, white-label, API access |

### Stripe Products (KINGDOM LTD - acct_1SoV6VEHrm7Q2JIn)
- `prod_Tm3yvErLQFwjjM` - Activation Fee (€9.90 one-time)
- `prod_Tm3yo6o2IkxEjW` - Pro Plan (€30/month)
- `prod_Tm3yyZw4qEQRGI` - Scale Plan (€99/month)
- `prod_Tm3yaCvF6DUXMN` - Student Plus (€9.90/month)

### Database Tables
- `billing_plans` - Plan configurations
- `creator_billing` - Creator billing state (includes balance columns)
- `billing_transactions` - Transaction ledger
- `creator_sales` - Sales with platform fees
- `webhook_events` - Idempotent webhook log
- `pending_balances` - Funds in 7-day hold period
- `balance_transactions` - Balance ledger (credits, debits, adjustments)
- `payouts` - Payout history with Stripe transfer IDs
- `reserve_releases` - Scheduled reserve releases (120-day rolling)

### Balance System
The platform uses a **wallet model** - platform collects 100% of payments, tracks creator balances in database, processes weekly payouts via Connect.

**Balance Types** (columns on `creator_billing`):
| Column | Purpose |
|--------|---------|
| `pending_balance_cents` | Funds in 7-day hold |
| `available_balance_cents` | Ready for withdrawal |
| `reserved_balance_cents` | 10% reserve (new creators, 120-day) |
| `negative_balance_cents` | Chargeback debt |
| `total_earned_cents` | Lifetime earnings |
| `total_paid_out_cents` | Lifetime payouts |

**Chargeback Deduction Order**: available → reserved → negative

**Withdrawal Rules**:
- Minimum €50 (5000 cents)
- 72-hour cooldown between withdrawals
- Connect account must be active

**Scheduled Jobs** (GitHub Actions cron):
- Daily 6:00 AM UTC: Release pending balances (7-day hold)
- Friday 9:00 AM UTC: Process automatic payouts

### Edge Functions
Located in `supabase/functions/`:
- `stripe-checkout` - Create Checkout sessions
- `stripe-subscription` - Manage subscriptions
- `stripe-connect` - Creator payout onboarding
- `stripe-webhook` - Handle Stripe webhooks (incl. disputes)
- `student-plus-checkout` - Student subscription checkout
- `student-plus-portal` - Student billing portal
- `community-checkout` - Paid community access checkout
- `release-pending-balances` - Cron: move pending→available after 7 days
- `creator-withdrawal` - Manual withdrawal API (status, withdraw)
- `process-payouts` - Cron: batch automatic payouts
- `admin-reset-password` - Admin: reset user passwords (creator-only)

## Environment

### Dependencies
Key packages from `package.json`:
- `@stripe/react-stripe-js` + `@stripe/stripe-js` - Stripe integration
- `@supabase/supabase-js` - Database client
- `@google/genai` - Gemini AI
- `react-router-dom` - Routing
- `recharts` - Charts/analytics
- `lucide-react` - Icons

### Required Environment Variables
```bash
# Supabase
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Stripe (client-side)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Stripe (server-side - Supabase secrets)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### External Services
- **Supabase**: Database, Auth, Edge Functions
- **Stripe**: Payments, Subscriptions, Connect
- **Gemini**: AI-powered student success analysis
- **Vercel**: Analytics (`@vercel/analytics`)

## Agent Coordination
This project uses the multi-agent chatroom system. Agents communicate via `chatroom.md`.

### Agent Definitions
Located in `.claude/agents/`:
- **coordinator.md** - Orchestrate complex multi-agent tasks, break down work, assign to agents
- **explorer.md** - Research and understand the codebase, find patterns and gather context
- **architect.md** - Make design decisions, define structure, create implementation plans
- **implementer.md** - Write production code following the Architect's design
- **reviewer.md** - Review code for quality, security, and correctness
- **debugger.md** - Investigate issues, find root causes, fix bugs
- **tester.md** - Write tests and verify implementations work correctly

### Chatroom Structure
The chatroom uses this format (template in `.claude/templates/chatroom-template.md`):
- **Mission** - Current task description
- **Agents Table** - Role, Status, Last Active, Current Focus
- **Active Context** - Project, Stack, Key Paths
- **Task Queue** - Checklist of tasks (completed, remaining, deferred)
- **Thread** - Chronological agent updates with `### [Date] [Agent]` format
- **Decisions Log** - Table of decisions with rationale
- **Artifacts** - Files created/modified
- **Blocked Items** - Current blockers

### Commands
- `/coordinate [task]` - Start coordinated multi-agent work
- `/reset-chatroom` - Clear chatroom for new task (use template)
- `/learn` - Update this CLAUDE.md with conversation learnings

## Agent Coordination (Agent Mail - MCP)

Agent Mail is **separate** from the role-based agents in `.claude/agents/`. Use Agent Mail for MCP coordination, and use the agent roles for workflow structure.

This project supports Agent Mail for MCP-based multi-agent coordination. **Follow these steps at the start of every session:**

### Session Startup (REQUIRED)
At the beginning of each session, call:
```
macro_start_session(
  human_key="/Users/bojodanchev/creator-club™",
  program="claude-code",  // or "codex-cli" for Codex
  model="<your_model>",   // e.g., "opus", "sonnet", "gpt-5-codex"
  task_description="<brief description of your current task>"
)
```

This registers you as an agent and fetches any pending messages.

**Example (Codex CLI):**
```
macro_start_session(
  human_key="/Users/bojodanchev/creator-club™",
  program="codex-cli",
  model="gpt-5-codex",
  task_description="Describe the task succinctly"
)
```

### Strict Workflow (ENFORCED)
**Do not start work until Agent Mail is initialized.**
1. Run `macro_start_session(...)` at the very beginning of the session.
2. Immediately call `fetch_inbox(...)` and handle any `ack_required` messages.
3. Before editing shared or contested files, reserve them with `file_reservation_paths(...)`.
4. After each meaningful work unit (or when blocked), send a status update via `send_message(...)` and re-check `fetch_inbox(...)`.
5. Before final response, run `fetch_inbox(...)` one last time and acknowledge required messages.

**Codex CLI defaults** (use these unless explicitly told otherwise):
- `program="codex-cli"`
- `model="gpt-5-codex"`
- `agent_name="Codex"`

### Check Inbox Regularly
After completing significant work units, check for coordination messages:
```
fetch_inbox(project_key="/Users/bojodanchev/creator-club™", agent_name="<YourAgentName>")
```

### File Reservations (Before Editing Contested Files)
Before editing files that other agents might touch, reserve them:
```
file_reservation_paths(
  project_key="/Users/bojodanchev/creator-club™",
  agent_name="<YourAgentName>",
  paths=["src/important-file.ts", "src/shared/**/*.ts"],
  ttl_seconds=3600,
  exclusive=true,
  reason="Implementing feature X"
)
```

Release when done:
```
release_file_reservations(project_key="/Users/bojodanchev/creator-club™", agent_name="<YourAgentName>")
```

### Send Status Updates
When completing major tasks or needing input from other agents:
```
send_message(
  project_key="/Users/bojodanchev/creator-club™",
  sender_name="<YourAgentName>",
  to=["<OtherAgentName>"],  // or check resource://agents/<project> for active agents
  subject="Completed auth refactor",
  body_md="Finished implementing OAuth flow. Ready for review.",
  importance="normal"
)
```

### Acknowledge Messages
When you receive messages with `ack_required=true`:
```
acknowledge_message(project_key="/Users/bojodanchev/creator-club™", agent_name="<YourAgentName>", message_id=<id>)
```

### Discover Other Agents
To see who else is working on this project, check the agents resource or use:
```
whois(project_key="/Users/bojodanchev/creator-club™", agent_name="<AgentName>")
```

## Skills
Custom skills in `.claude/skills/`:
- `billing-integration.md` - Billing system implementation guide
- `stripe-integration.md` - Stripe API patterns
- `stripe-webhooks.md` - Webhook handling best practices
- `stripe-best-practices.md` - Security and PCI compliance

## Gotchas & Lessons Learned

### Stripe Integration
- **Webhook idempotency**: Always store `stripe_event_id` and check before processing
- **Currency in cents**: All amounts in database stored as integer cents (€30 = 3000)
- **RLS for billing**: `webhook_events` uses service_role only policy
- **Live mode webhook**: Must configure separately from test mode in Stripe Dashboard
- **Webhook endpoint**: `https://znqesarsluytxhuiwfkt.supabase.co/functions/v1/stripe-webhook` — MUST be deployed with `--no-verify-jwt`
- **Stripe fee estimation**: Webhook estimates Stripe fee as `amount * 2.9% + €0.25` (conservative). Actual fees vary by card type (EEA: 1.5% + €0.25, non-EEA: 2.9% + €0.25). We don't query actual fees from Stripe API.
- **Sale amount source**: Always use `session.amount_total` from Stripe (actual charged amount), NOT `community.price_cents` (list price). The actual amount differs for discounts, monthly subscriptions, and dual-pricing communities.
- **RLS on `creator_sales`/`billing_transactions`**: Must use `get_my_profile_id()` in policies, NOT `auth.uid()` — these tables store profile IDs, not auth user IDs

### Billing Data Flow (Community Purchases)
Community purchases use **Stripe Connect destination charges** — funds go directly to the creator's Connect account via `transfer_data.destination` + `application_fee_amount`/`application_fee_percent`.

| Table | What it stores | Who writes |
|-------|---------------|------------|
| `community_purchases` | Purchase records (created at checkout, updated by webhook) | community-checkout + stripe-webhook |
| `creator_sales` | Revenue records for creator reporting (shown in "Community Sales" section) | stripe-webhook |
| `billing_transactions` | Platform wallet operations (activation fees, plan subscriptions) — NOT used for community sales | stripe-webhook |
| `creator_billing` | Balance summary — `available_balance_cents` updated by webhook on each sale | stripe-webhook |
| `balance_transactions` | Audit trail for balance changes | stripe-webhook |

**Billing Settings Page sections**:
- **Balance Card** — reads from `creator_billing` columns (pending/available/reserved/negative), always visible
- **Revenue Overview** — aggregates from `creator_sales` (this month + all time)
- **Community Sales** — lists individual `creator_sales` records
- **Withdrawal History** — lists `payouts` records (withdrawal/payout requests)

### Webhook Sale Recording (Idempotency)
The webhook has TWO layers of duplicate prevention:
1. **`webhook_events` table** — checks `stripe_event_id` before processing any event
2. **`creator_sales` duplicate check** — before inserting, checks if a completed sale already exists for the same `creator_id + buyer_id + product_id`

Both are needed because manual data backfills bypass `webhook_events`, and Stripe retries can arrive after partial processing.

### JavaScript Falsy Zero Bug (CRITICAL)
**NEVER use `||` for numeric fallbacks that could be 0:**
```javascript
// WRONG: 0% fee (Exclusive plan) becomes 6.9%
const feePercent = plan?.platform_fee_percent || 6.9;

// CORRECT: only falls back for null/undefined
const feePercent = plan?.platform_fee_percent ?? 6.9;
```
This bug existed in both `stripe-webhook` and `community-checkout` — Exclusive plan creators (0% fee) were charged 6.9%.

### Discount Codes
- **100% discount bypass**: When `finalPriceCents <= 0`, skip Stripe entirely, grant access server-side
- **`community_purchases` NOT NULL columns**: Insert must include `stripe_fee_cents` and `creator_payout_cents` (both 0 for free grants) — no defaults on these columns
- **i18n for duration labels**: Use `t('discounts.duration.forever')` / `.firstMonth` / `.months')` — NOT hardcoded English `getDurationLabel()`

### TBI Bank Fusion Pay (BNPL)
- **API URL**: `https://beta.tbibank.support/api` — "beta" IS the production URL
- **Credentials**: reseller_code=BJKZ, reseller_key=creatorclub, encryption via TBI_ENCRYPTION_KEY secret
- **Encryption**: AES-256-CBC, key=first 32 bytes, IV=first 16 bytes of key, PKCS7+base64 output
- **Required item fields**: `category` (use "255" for generic), `name`, `qty`, `price`
- **EUR mandatory**: `currency: "EUR"` required in encrypted payload from Jan 2026
- **Deploy**: Always via CLI (`npx supabase functions deploy tbi-checkout`), NOT MCP deploy
- **Testing**: Use student account `bozhidar.danchev@mmfintech.io`, test EGN: `8501011234`
- **Known issue (2026-02-11)**: TBI beta server has PHP 8 bug in Request.class.php:671 (Attempt to assign property "currency" on null). Affects ALL RegisterApplication calls including TBI's own test credentials. GetCalculations works fine.

### Supabase Edge Functions
- **Shared code**: Import from `../_shared/` for common utilities
- **CORS**: Headers must be set for browser requests
- **Secrets**: Use `supabase secrets set` for API keys (or `npx supabase secrets set` if CLI auth fails)
- **MCP deployment gotcha**: The Supabase MCP `deploy_edge_function` tool doesn't resolve `../_shared/` imports. Either inline dependencies or deploy via CLI.
- **`verify_jwt` for webhooks (CRITICAL)**: External webhook receivers (Stripe, TBI) MUST be deployed with `--no-verify-jwt`. Supabase's gateway rejects requests without a valid JWT at the gateway level (HTTP 401), before the function code even runs. These functions implement their own authentication (e.g., Stripe signature verification). Use: `npx supabase functions deploy stripe-webhook --no-verify-jwt`

### Vercel Cron (Requires Pro Plan)
- **Vercel Cron requires Pro**: Free tier cannot use `vercel.json` cron configuration
- **Use GitHub Actions instead**: `.github/workflows/` with `schedule:` triggers is free
- **Cron authentication**: Edge functions called by cron should verify a `CRON_SECRET` in the request body

### TypeScript
- **Strict mode**: Project uses strict TypeScript
- **Type imports**: Use `import type` for type-only imports

### RLS Policies for Public Data
- **Anon vs Authenticated gap**: When adding RLS policies for public data, remember to add policies for BOTH `anon` AND `authenticated` roles. A policy targeting only `anon` won't apply to logged-in users.
- **Community member counts**: The `memberships` table requires policies for both roles to display counts correctly on public community pages
- **Key files for community RLS**:
  - `supabase/migrations/008_public_community_access.sql` - anon policies
  - `supabase/migrations/fix_membership_count_rls.sql` - authenticated policy fix

### RLS Policy Creation (CRITICAL - Always Follow)

**The `public` role trap**: In Supabase, `anon` and `authenticated` roles do NOT inherit from the `public` pseudo-role. When you omit the `TO` clause in CREATE POLICY, PostgreSQL defaults to `PUBLIC`, but this creates a policy that authenticated users cannot use!

**MANDATORY: Always explicitly specify roles in CREATE POLICY:**
```sql
-- WRONG - defaults to 'public' role, authenticated users can't use it
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

**RLS Policy Checklist (use before every migration):**
1. ✅ **Explicit role**: Always include `TO authenticated` or `TO anon` - NEVER omit
2. ✅ **Auth check in USING**: For policies that should only work for logged-in users, include `auth.uid() IS NOT NULL` or use `get_my_profile_id()` which returns NULL for anonymous users
3. ✅ **Test both roles**: After creating a policy, mentally verify: "Would this work for anon? Would this work for authenticated?"
4. ✅ **Check pg_policies**: After migration, verify with:
   ```sql
   SELECT policyname, roles FROM pg_policies WHERE tablename = 'your_table';
   ```
   Ensure `roles` shows `{authenticated}` not `{public}`

**Common failure pattern (what happened with team invites):**
- Policy created without `TO` clause → stored as `roles: {public}`
- Authenticated user tries to use it → policy not evaluated for their role
- Silent RLS failure → "new row violates row-level security policy"

### Routing & Role-Based Access
- **Role-aware routes**: Routes like `/dashboard` render different content based on user role via `AppLayout.renderContent()`
- **Don't over-restrict**: Avoid using `allowedRoles` on routes if `AppLayout` already handles role-based content - it causes "Access Denied" instead of showing appropriate content
- **Post-login redirect**: `getDefaultRedirectPath(role)` in App.tsx determines where users go after login (creators → `/dashboard`, students → `/courses`)
- **ProtectedRouteWrapper**: Handles auth check + optional role restriction. When role restriction fails, shows Access Denied page
- **Key files**:
  - `src/App.tsx` - Route definitions, `AppLayout`, `getDefaultRedirectPath()`
  - `src/public-pages/auth/ProtectedRoute.tsx` - Role-based access control component
  - `src/features/student/StudentHome.tsx` - Student landing page

### Profile ID vs User ID (CRITICAL)
- **The distinction**: `profile.id` is an auto-generated UUID in the `profiles` table. `profile.user_id` (and `user.id` from auth) is the `auth.users.id` FK. These are DIFFERENT values.
- **Database FK references**: ALL `creator_id` and `user_id` columns in tables (courses, communities, enrollments, memberships, tasks, etc.) reference `profiles.id`, NOT `auth.users.id`
- **Why bugs were hidden**: For some users (like the original developer), `profile.id` happened to equal `profile.user_id` by coincidence. Code using wrong ID worked. For other users (like Simeon), they differ, causing RLS failures.
- **useAuth() pattern**: The hook returns `{ user, profile, role }`. Always use `profile.id` for database operations, not `user.id`
- **Two service patterns**:
  1. **Internal lookup services** (communityService.ts, some pointsService functions): Accept auth `user.id`, do internal profile lookup
  2. **Direct profile.id services** (courseService.ts, dashboardService.ts, eventService.ts): Expect `profile.id` passed directly
- **Defense in depth**: Services that do internal profile lookup are more robust. When adding new services, prefer the internal lookup pattern.

### Internationalization (i18n) - MANDATORY VERIFICATION

**After completing ANY UI implementation, you MUST verify i18n is properly wired:**

1. **Check translation key usage**: Ensure all user-facing text uses `t('namespace.key')` pattern
2. **Verify BOTH locale files**: Check that keys exist in BOTH `src/i18n/locales/en.json` AND `src/i18n/locales/bg.json`
3. **Match structure exactly**: Bulgarian (bg.json) structure must mirror English (en.json) structure - nested keys must match
4. **Common failure patterns**:
   - English uses `table.headers.student`, Bulgarian has flat `table.student` → keys won't resolve
   - Missing keys in one locale → shows translation key as text (e.g., "studentManager.page.description")
   - Hardcoded English strings in components → won't translate

**Verification checklist after UI work:**
```bash
# Search for hardcoded strings in the component you modified
grep -n "\"[A-Z][a-z]" src/features/<feature>/<component>.tsx

# Compare key structure between locales
grep -A5 '"<namespace>"' src/i18n/locales/en.json
grep -A5 '"<namespace>"' src/i18n/locales/bg.json
```

**Default language**: Bulgarian (bg) - the app defaults to Bulgarian for the Bulgarian market

### Bio vs Biography (Settings Fields)

Two distinct profile text fields exist for different purposes:

| Field | Table | Location | Purpose |
|-------|-------|----------|---------|
| **Bio** | `profiles.bio` | Profile Settings tab | Short personal bio for community interactions (profile popups, chat member cards). 500 char limit. |
| **Biography** | `creator_profiles.bio` | Creator Settings tab | Marketing copy for community landing page "Created By" section. Sells creator to potential students. |

**Key files**:
- `src/features/settings/ProfileSettings.tsx` - Bio field (community interactions)
- `src/features/settings/CreatorSettings.tsx` - Biography field (landing page marketing)
- `src/features/community/CommunityLandingPage.tsx` - Displays creator biography

**Translation keys**:
- Bio: `creatorSettings.profile.bio.*`
- Biography: `creatorSettings.creator.biography.*`

### Team Members System (Lecturers, Assistants, Guest Experts)

The platform supports inviting team members to communities who have special roles distinct from regular members.

**Architecture**:
- **Database**: `community_team_members` table with `invite_token`, `invite_status`, `role`, `title`, `bio`, `is_messageable`
- **Roles**: `lecturer`, `assistant`, `guest_expert` - each maps to badge type (`team` or `guest`)
- **Auth tracking**: `AuthContext` tracks `teamMemberships`, `isTeamMemberOnly`, `primaryTeamCommunity`
- **Navigation**: Team-only users see `TEAM_MEMBER_NAV_ITEMS` (Dashboard, Community, Classroom, Calendar, Messages)

**Key files**:
| File | Purpose |
|------|---------|
| `src/features/direct-messages/teamService.ts` | Invite creation, acceptance, team member CRUD |
| `src/features/direct-messages/dmService.ts` | DM conversations, `isTeamMember()`, `getTeamMemberConversations()` |
| `src/features/team/TeamDashboard.tsx` | Dashboard for team-only users |
| `src/features/team/TeamInboxPage.tsx` | Team member message inbox |
| `src/features/direct-messages/pages/TeamSettingsTab.tsx` | Creator's team management UI |
| `src/features/direct-messages/pages/TeamProfilePage.tsx` | Public team member profile |
| `src/public-pages/invite/TeamInvitePage.tsx` | Invite acceptance flow |

**Team member journey**:
1. Creator creates invite in `TeamSettingsTab` → generates token with 7-day expiry
2. Invitee visits `/invite/team/:token` → sees role, title, community info
3. On accept: `acceptTeamInvitation()` sets `profile_id`, creates membership
4. Team member sees `TeamDashboard` with messages, courses (lecturers), events, profile
5. DMs work via `ChatPanel` with `viewMode='inbox'` for team members

**Known limitation**: Lecturers see student view in `CourseLMS.tsx` because it only checks `role === 'creator'`. Their courses display on TeamDashboard but they can't edit via the main Courses page. Intentionally not fixed yet.

### i18next Pluralization (v21+)

**Use `_one`/`_other` suffixes**, NOT `_plural`:
```json
// Correct (i18next v21+)
"expiresIn_one": "Expires in {{count}} day",
"expiresIn_other": "Expires in {{count}} days"

// Wrong (old format)
"expiresIn": "Expires in {{count}} day",
"expiresIn_plural": "Expires in {{count}} days"
```

### AI API Configuration

The platform uses **Gemini API** (not OpenAI) for AI features:
- **Environment variable**: `VITE_GEMINI_API_KEY`
- **Used by**: AI Success Manager, Community Chatbots
- **Edge function**: `supabase/functions/ai-chat/index.ts`
- **Model**: Gemini 2.0 Flash

**Key files**:
- `src/features/ai-manager/geminiService.ts` - AI Success Manager service
- `src/features/chatbots/ChatbotConversation.tsx` - Community chatbot UI

## Admin Operations

### Password Reset (for locked-out users)

When users can't log in and email reset isn't working (Supabase built-in email has poor deliverability):

**Option 1: Direct SQL** (quickest for ad-hoc)
```sql
UPDATE auth.users
SET
  encrypted_password = crypt('NEW_PASSWORD_HERE', gen_salt('bf')),
  updated_at = now()
WHERE email = 'user@example.com';
```

**Option 2: Edge Function** (requires creator auth token)
```bash
curl -X POST 'https://znqesarsluytxhuiwfkt.supabase.co/functions/v1/admin-reset-password' \
  -H 'Authorization: Bearer CREATOR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"email": "user@example.com", "newPassword": "newpass123"}'
```

### Email Deliverability Issues

Supabase's built-in email (`noreply@mail.app.supabase.io`) has known issues:
- Poor deliverability (often goes to spam or blocked)
- Rate limited (3 emails/hour per user)
- Check auth logs for `429: email rate limit exceeded` errors

**Long-term fix**: Configure custom SMTP in Supabase Dashboard → Authentication → SMTP Settings (use Resend, Postmark, or SendGrid).

## Discovery Log

> **Detailed implementation history extracted to:** `docs/discovery-log.md`
>
> Key entries (search the file for details):
> - [2025-12-30] Billing System Complete Implementation
> - [2026-01-03] Profile ID vs User ID Mismatch Fix (CRITICAL)
> - [2026-01-03] Edge Function 401 Authentication Fix
> - [2026-01-03] Community Monetization Implementation
> - [2026-01-04] Quiz-Based Module Unlock System
> - [2026-01-06] Logo Component Implementation
> - [2026-01-11] Stripe Business Account Migration (KINGDOM LTD)
> - [2026-01-15] Creator Balance & Payout System Implementation
> - [2026-01-24] Team Member System Review & Pending Invite UX Improvements
> - [2026-01-28] RLS Policy Role Bug Fix - Always use explicit `TO authenticated` clause
> - [2026-02-14] Stripe Webhook 401 Fix (CRITICAL) - verify_jwt was true, all events rejected
> - [2026-02-14] Discount Codes Wired into Payment Flow + 100% Bypass
> - [2026-02-14] Dual Pricing Migration Applied (both one-time + monthly)
> - [2026-02-14] Payment Success Notification Redesign + Broken i18n Fix
> - [2026-02-14] Billing Settings: Wired creator_sales, Fixed Fee Calculation, Deduplicated Sections
