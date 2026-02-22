# Payment Flow Review by Codex (Verbose Handoff)

Scope: creator + student payment flows, processes, screens, and implementation based on repo inspection only (no Stripe/Supabase access). Intended as a handoff to another reviewer.

Overall production readiness: **Not ready**. Multiple blockers across Student Plus, community subscriptions, and course purchases, plus data/ledger mismatches that can lead to incorrect payouts or broken access.

---

## 1) High-level system map (what exists)

### Client (frontend)
- Creator billing UI: pricing, onboarding (activation fee), billing settings, balance/payouts.
- Student UI: community purchase flow (public), Student Plus subscription.
- Course purchase modal uses Stripe Elements PaymentIntent.

### Backend (Supabase Edge Functions)
- `stripe-checkout`: activation fee + creator subscription checkout + payment-intent for sales.
- `stripe-subscription`: plan changes, cancel/resume, billing portal.
- `stripe-connect`: Connect onboarding + status + dashboard link.
- `community-checkout`: community paid checkout (monthly or one-time).
- `community-portal`: billing portal for community subscriptions.
- `stripe-webhook`: handles multiple Stripe webhook events; updates creator_billing, community memberships, creator sales, balance system, disputes, payouts.
- `creator-withdrawal`: manual payout.
- `process-payouts` + `release-pending-balances`: cron-like functions for payouts and balance releases.

### DB Migrations
- `011_billing_system.sql`: core billing tables, plan seed.
- `012_billing_security.sql`: triggers + RLS hardening.
- `013_community_monetization.sql`: community purchase tables/columns.
- `026_balance_system.sql`: pending balances, reserve releases, payouts, balance transactions.

---

## 2) Critical findings (blockers for production)

### 2.1 Student Plus is not operational
**Why:**
- Checkout function uses `profiles.id` lookup incorrectly (`eq('id', user.userId)`), where `user.userId` is `auth.users.id`, not `profiles.id`. This can make checkout fail.
  - `supabase/functions/student-plus-checkout/index.ts:79-88`
- No webhook handlers update `student_subscriptions` for Student Plus checkouts or subscription events.
  - `supabase/functions/stripe-webhook/index.ts:226-347`
- The client depends on `student_subscriptions`, `loyalty_points`, `loyalty_milestones`, `rewards`, and RPCs (`get_student_point_balance`, `redeem_reward`) but there are **no migrations** for them in this repo.
  - `src/features/studentPlus/studentPlusService.ts:27-199`

**Impact:** Student Plus is broken end-to-end (checkout likely fails; subscription state never updates; rewards/loyalty data missing).

---

### 2.2 Community subscription webhooks corrupt creator billing
**Why:**
Community monthly subscriptions created in `community-checkout` include `creator_id` in metadata. `stripe-webhook`’s `handleSubscriptionCreated` assumes any subscription with `creator_id` is a **creator plan subscription**, and updates `creator_billing`.
- `supabase/functions/community-checkout/index.ts:415-428`
- `supabase/functions/stripe-webhook/index.ts:325-347`

**Impact:** A student subscribing to a community can overwrite the creator’s billing subscription state, breaking plan billing.

---

### 2.3 Funds model mismatch (Connect destination vs wallet balance)
**Why:**
- Checkout flows for community and product sales use **destination charges** (Connect `transfer_data` + application fee). Funds go directly to creator Connect account.
  - `supabase/functions/community-checkout/index.ts:414-444`
  - `supabase/functions/stripe-checkout/index.ts:323-334`
- Webhook credits **pending balances** and reserves assuming the platform holds funds for later payout.
  - `supabase/functions/stripe-webhook/index.ts:719-785`

**Impact:** System can record balances the platform never received, leading to double counting, inaccurate payouts, or inconsistent financial reporting.

---

### 2.4 Community monthly renewal revenue is not credited
**Why:**
- `checkout.session.completed` handles initial purchase.
- For recurring subscriptions (`invoice.paid` / `customer.subscription.updated`) it only updates membership status/expiry, not `creator_sales` or balances.
  - `supabase/functions/stripe-webhook/index.ts:271-299`
  - `supabase/functions/stripe-webhook/index.ts:839-879`

**Impact:** creators are not credited for recurring community subscriptions.

---

### 2.5 Paid course purchases don’t grant access and likely fail
**Why:**
- Course purchase uses `buyerId={user.id}` (auth id), but backend expects **profile ids** (FKs to `profiles.id`).
  - `src/features/courses/CourseLMS.tsx:1241-1248`
  - `src/features/billing/stripeService.ts:723-743`
- `createSalePaymentIntent` validates ids as profile ids; checkout can fail.
- Even if payment succeeds, there is **no enrollment** created after payment; `handlePurchaseSuccess` only reloads courses.
  - `src/features/courses/CourseLMS.tsx:265-269`

**Impact:** Students can pay and still not be enrolled; or checkout may fail entirely.

---

## 3) Additional high-risk issues

### 3.1 Plan changes may break due to missing Stripe price IDs in DB
`stripe-subscription` uses `billing_plans.stripe_price_id`, but seed data does not set it.
- `supabase/functions/stripe-subscription/index.ts:224-232`
- `supabase/migrations/011_billing_system.sql:393-430`

**Impact:** plan upgrades/downgrades via Stripe subscriptions can fail.

---

### 3.2 Community sales ledger ignores discounts and currency
Webhook builds `creator_sales` using base `community.price_cents` and hardcodes EUR, ignoring discounts and actual checkout currency.
- `supabase/functions/stripe-webhook/index.ts:673-712`

**Impact:** over-reported revenue, wrong fee accounting, broken financial reporting for non-EUR or discounted purchases.

---

### 3.3 Activation fee is inconsistent across UI/tests/docs
- DB comments + tests reference EUR 2.90; UI and Stripe config use 9.90.
  - `supabase/migrations/011_billing_system.sql:15-22`
  - `tests/fixtures/test-config.ts:41-46`
  - `src/features/billing/pages/OnboardingPage.tsx:260`

**Impact:** pricing confusion and failing tests.

---

### 3.4 Dispute handling references nonexistent columns
Dispute handler tries to match `creator_sales.stripe_checkout_session_id`, which does not exist.
- `supabase/functions/stripe-webhook/index.ts:918-933`
- `supabase/migrations/011_billing_system.sql:188-217`

**Impact:** dispute resolution fails to find creator, balances won’t update correctly.

---

### 3.5 Payout handlers likely don’t map to creator accounts
`payout.paid` / `payout.failed` handlers use `payout.destination` as `stripe_account_id`. In Stripe payout events, destination is the bank account, not the Connect account.
- `supabase/functions/stripe-webhook/index.ts:498-538`

**Impact:** payout transaction ledger updates may never occur.

---

### 3.6 Cron-based flows have no repo-level scheduler
Balance release and payout processing rely on cron execution but repo doesn’t configure it.
- `supabase/functions/release-pending-balances/index.ts:7-73`
- `supabase/functions/process-payouts/index.ts:6-94`

**Impact:** balances won’t move to available; payouts won’t happen.

---

## 4) Creator-side flow review (by surface)

### 4.1 Activation fee (creator onboarding)
**UI:** `OnboardingPage`
- Checks `creator_billing.activation_fee_paid`; if not paid, shows activation fee CTA.
- Calls `createActivationCheckout` -> Stripe hosted checkout.
- On success: redirects to `/settings?tab=billing` after 3 seconds.
- `src/features/billing/pages/OnboardingPage.tsx:70-110`

**Backend:**
- `stripe-checkout` action `activation` creates checkout session with product/price from `_shared/stripe`.
- `stripe-webhook` handles `checkout.session.completed` to set `activation_fee_paid=true` and insert billing transaction.
- `supabase/functions/stripe-checkout/index.ts:106-176`
- `supabase/functions/stripe-webhook/index.ts:226-263`

**Gaps/Risks:**
- Activation fee amount inconsistent across system.
- No evidence of `creator_billing` row creation in repo.

---

### 4.2 Creator plan changes (Starter/Pro/Scale)
**UI:**
- `PricingPage` and `BillingSettingsPage` allow plan change; uses `changePlan` and possibly `createPlanSubscription`.
- `src/features/billing/pages/PricingPage.tsx:70-111`
- `src/features/billing/pages/BillingSettingsPage.tsx:183-214`

**Backend:**
- `stripe-subscription` handles change, cancel, resume, billing portal.
- If has first sale and no subscription, returns `requiresCheckout`.
- `supabase/functions/stripe-subscription/index.ts:180-260`

**Gaps/Risks:**
- Requires `billing_plans.stripe_price_id`, but seed doesn’t set it.
- UX allows early subscription activation even though pricing is “after first sale.”

---

### 4.3 Stripe Connect onboarding (payouts)
**UI:**
- Billing Settings: Setup Payouts uses `createConnectAccount` and `getConnectOnboardingLink`.
- `src/features/billing/pages/BillingSettingsPage.tsx:339-359`

**Backend:**
- `stripe-connect` creates Express account and stores in `creator_billing`.
- `account.updated` webhook updates `stripe_account_status`.
- `supabase/functions/stripe-connect/index.ts:90-225`
- `supabase/functions/stripe-webhook/index.ts:473-491`

**Gaps/Risks:**
- If `creator_billing` missing, onboarding fails.
- No environment separation (live only).

---

### 4.4 Balance + payouts
**UI:**
- Billing Settings shows balance breakdown, allows withdrawal.
- `src/features/billing/pages/BillingSettingsPage.tsx:120-149`
- `src/features/billing/components/BalanceCard.tsx:1-200`

**Backend:**
- `creator-withdrawal` enforces min amount 50 EUR and 72h cooldown.
- Scheduled `process-payouts` and `release-pending-balances` required.
- `supabase/functions/creator-withdrawal/index.ts:98-305`
- `supabase/functions/process-payouts/index.ts:6-119`
- `supabase/functions/release-pending-balances/index.ts:7-90`

**Gaps/Risks:**
- Depends on balance system but checkout uses Connect destination charges.
- Cron scheduling not configured.

---

### 4.5 Creator sales (courses/products)
**UI:**
- Course purchase modal in student view.

**Backend:**
- `stripe-checkout` action `payment-intent` creates PaymentIntent with Connect destination.
- `stripe-webhook` `payment_intent.succeeded` inserts `creator_sales` and triggers first sale.
- `supabase/functions/stripe-checkout/index.ts:278-344`
- `supabase/functions/stripe-webhook/index.ts:411-442`

**Gaps/Risks:**
- Buyer/creator ID mismatch (auth vs profile).
- No enrollment created after payment.

---

## 5) Student-side flow review (by surface)

### 5.1 Community purchase (paid community access)
**UI:**
- Join button on public community page triggers `createCommunityCheckout` for paid pricing; free uses `joinCommunity`.
- `src/public-pages/communities/JoinButton.tsx:118-151`

**Backend:**
- `community-checkout` creates Stripe session; creates pending membership and pending purchase.
- `stripe-webhook` handles `checkout.session.completed` to update membership, purchases, and creator_sales/pending balances.
- `supabase/functions/community-checkout/index.ts:379-473`
- `supabase/functions/stripe-webhook/index.ts:599-785`

**Gaps/Risks:**
- Subscription metadata conflicts with creator subscriptions (critical bug).
- Ledger uses full price, not discounted amount.
- Balance logic mismatch with destination charges.

---

### 5.2 Community subscription management (cancel)
**UI:**
- Leave community modal allows cancel via Stripe portal if subscription exists.
- `src/features/community/components/LeaveCommunityModal.tsx:92-112`

**Backend:**
- `community-portal` creates billing portal session.
- `stripe-webhook` updates membership status on subscription updates/deletes.
- `supabase/functions/community-portal/index.ts:52-94`
- `supabase/functions/stripe-webhook/index.ts:839-897`

**Gaps/Risks:**
- No revenue recognition for renewals.
- If membership’s `stripe_customer_id` missing, portal fails.

---

### 5.3 Course purchase (paid courses)
**UI:**
- CoursePurchaseModal uses Stripe Elements to confirm payment.
- Calls `createSalePaymentIntent` before rendering payment form.
- `src/features/courses/components/CoursePurchaseModal.tsx:49-110`

**Backend:**
- `stripe-checkout` action `payment-intent` uses Connect destination charges.
- `stripe-webhook` `payment_intent.succeeded` inserts creator_sales and triggers first sale.
- `supabase/functions/stripe-checkout/index.ts:278-344`
- `supabase/functions/stripe-webhook/index.ts:411-442`

**Gaps/Risks:**
- BuyerId is auth user id; backend expects profile id.
- No enrollment created after payment.

---

### 5.4 Student Plus subscription + loyalty/rewards
**UI:**
- `StudentPlusPage` provides checkout redirect, success/cancel feedback, and loyalty dashboards.
- `src/features/studentPlus/components/StudentPlusPage.tsx:49-80`

**Backend:**
- `student-plus-checkout` creates subscription checkout session.
- `student-plus-portal` creates billing portal session.
- `supabase/functions/student-plus-checkout/index.ts:60-156`
- `supabase/functions/student-plus-portal/index.ts:43-90`

**Gaps/Risks:**
- No migrations for `student_subscriptions`, `loyalty_points`, `rewards`.
- Wrong profile lookup in checkout (auth vs profile).
- Missing webhook for subscription creation/updates, so status never becomes active.
- Rewards/loyalty depend on RPCs not in repo.

---

## 6) Schema / data dependencies checklist

### Core billing tables
- `billing_plans`, `creator_billing`, `billing_transactions`, `creator_sales`, `webhook_events`
- `supabase/migrations/011_billing_system.sql`

### Community monetization tables
- `community_purchases`, `communities` pricing columns, membership payment tracking
- `supabase/migrations/013_community_monetization.sql`

### Balance system
- `pending_balances`, `balance_transactions`, `payouts`, `reserve_releases`, new fields on `creator_billing`
- `supabase/migrations/026_balance_system.sql`

### Missing in repo (but referenced)
- `student_subscriptions`
- `loyalty_points`
- `loyalty_milestones`
- `student_milestone_achievements`
- `rewards`
- `reward_redemptions`
- RPCs: `get_student_point_balance`, `redeem_reward`, `increment_discount_usage`
- `src/features/studentPlus/studentPlusService.ts:27-199`

---

## 7) Readiness verdict

**Not ready for production.**
- Student Plus flows are incomplete.
- Community subscriptions corrupt creator billing state.
- Balance system conflicts with Connect payout flow.
- Course purchase does not grant access.
- Data/model inconsistencies and missing migrations exist.

---

## 8) Suggested priority fixes (for future reviewer)

1) **Student Plus**: add migrations + webhook handlers; fix profile lookup to use `profiles.user_id`; implement subscription update logic.
2) **Subscription metadata**: ensure community subscriptions do not update `creator_billing`.
3) **Funds model**: choose either destination charges or platform balance (not both).
4) **Community renewal accounting**: credit creator sales + pending balances on each renewal.
5) **Course purchase**: use `profile.id` for buyer_id and auto-enroll after payment success.
6) **Plan stripe_price_id**: seed in `billing_plans` or refactor to use config.
7) **Activation fee consistency**: align UI/tests/docs with config.
8) **Dispute + payout mapping**: ensure proper Stripe IDs are stored and queried.
9) **Cron setup**: ensure scheduled jobs exist for balance release and payouts.

---

## 9) Open questions for Claude reviewer

- Are `student_subscriptions`, `loyalty_*`, `rewards`, and RPCs (eg `get_student_point_balance`, `redeem_reward`) deployed outside this repo?
- How are `creator_billing` rows created for new creators (trigger, admin job, manual seed)?
- Which revenue model is final: destination charges (Connect split) or platform-held balances/payouts?
- Do you plan to support non-EUR community payments and discounts in ledger reporting?
- Are cron jobs already configured for `release-pending-balances` and `process-payouts`, and what is the intended `CRON_SECRET` handling?

---

## 10) Claude Reviewer Validation (2026-01-17)

### Answers to Open Questions

| Question | Answer |
|----------|--------|
| Student Plus tables exist? | ✅ YES - `student_subscriptions`, `loyalty_points`, `loyalty_milestones`, `rewards`, `reward_redemptions` all exist in DB |
| creator_billing rows created? | ✅ FIXED - Trigger `init_creator_billing_trigger` auto-creates on profile insert |
| Revenue model final? | ⚠️ CONFLICT - Code uses BOTH destination charges AND balance tracking (see below) |
| Non-EUR/discounts support? | ❌ NO - Hardcoded EUR, ledger ignores discounts |
| Cron jobs configured? | ✅ YES - `.github/workflows/balance-crons.yml` exists, `CRON_SECRET` set |

### Codex Finding Validation

| Finding | Valid? | Status | Notes |
|---------|--------|--------|-------|
| **2.1 Student Plus not operational** | ⚠️ PARTIAL | Needs work | Tables EXIST but webhook handlers for subscription updates missing |
| **2.2 Community subscription corrupts creator billing** | ✅ VALID | CRITICAL | `handleSubscriptionCreated` has no community subscription check |
| **2.3 Funds model mismatch** | ✅ VALID | CRITICAL | Destination charges + balance tracking = double counting |
| **2.4 Community renewal revenue not credited** | ✅ VALID | HIGH | `handleInvoicePaid` only handles creator plan renewals |
| **2.5 Course purchase no enrollment** | ✅ VALID | CRITICAL | Payment succeeds but no enrollment created |
| **3.1 Plan stripe_price_id missing** | ✅ VALID | HIGH | DB has OLD account price IDs, not KINGDOM LTD |
| **3.2 Ledger ignores discounts** | ✅ VALID | LOW | Uses full price_cents, not actual paid amount |
| **3.3 Activation fee inconsistent** | ✅ FIXED | DONE | UI now shows €9.90, matches Stripe |
| **3.4 Dispute handler bad column** | ✅ VALID | HIGH | References non-existent `stripe_checkout_session_id` |
| **3.5 Payout handler mapping** | ✅ VALID | MEDIUM | `payout.destination` is bank account, not Connect ID |
| **3.6 Cron not configured** | ❌ INVALID | DONE | GitHub Actions workflow exists |

---

## 11) Production Readiness Task List

### CRITICAL (Blocks Production)

- [ ] **Fix community subscription webhook corruption**
  - File: `supabase/functions/stripe-webhook/index.ts`
  - Line: 325-348 (`handleSubscriptionCreated`)
  - Fix: Add check `if (metadata?.type === 'community_subscription') return;` before updating `creator_billing`

- [ ] **Fix course purchase - no enrollment**
  - File: `supabase/functions/stripe-webhook/index.ts`
  - Line: 411-445 (`handlePaymentIntentSucceeded`)
  - Fix: After recording `creator_sales`, also create `enrollments` record for buyer

- [ ] **Resolve funds model conflict** (DESIGN DECISION REQUIRED)
  - OPTION A: Keep destination charges, REMOVE balance tracking/payout system (creator paid immediately)
  - OPTION B: Switch to platform collection, use balance system + manual transfers (current payout code)
  - Currently: Both are active = double-counting risk

### HIGH Priority

- [ ] **Add community subscription renewal revenue crediting**
  - File: `supabase/functions/stripe-webhook/index.ts`
  - Line: 271-302 (`handleInvoicePaid`)
  - Fix: Check if subscription is community type, credit `creator_sales` + `pending_balances`

- [ ] **Update billing_plans with correct Stripe price IDs**
  - Current (OLD): `price_1SjnKnFbO001Rr4nE31ve9YU`, `price_1SjnKnFbO001Rr4nrgpXSf0h`
  - Correct (KINGDOM LTD): `price_1SoVqmEHrm7Q2JIncZnyu9SY` (Pro), `price_1SoVqmEHrm7Q2JInneH7wG9d` (Scale)
  - SQL: `UPDATE billing_plans SET stripe_price_id = 'price_1SoVqmEHrm7Q2JIncZnyu9SY' WHERE tier = 'pro';`

- [ ] **Fix dispute handler column reference**
  - File: `supabase/functions/stripe-webhook/index.ts`
  - Line: 921
  - Fix: Remove `stripe_checkout_session_id` reference (column doesn't exist), use `stripe_charge_id` instead

- [ ] **Add Student Plus webhook handler**
  - File: `supabase/functions/stripe-webhook/index.ts`
  - Fix: Add handler for Student Plus subscription events to update `student_subscriptions` table

### MEDIUM Priority

- [ ] **Fix payout.paid handler Connect ID mapping**
  - File: `supabase/functions/stripe-webhook/index.ts`
  - Line: 498-538
  - Issue: `payout.destination` is bank account ID, not Connect account ID
  - Fix: Lookup Connect account from transfer metadata or payout account

- [ ] **Fix student-plus-checkout profile lookup**
  - File: `supabase/functions/student-plus-checkout/index.ts`
  - Line: 83
  - Issue: `.eq('id', user.userId)` should be `.eq('user_id', user.userId)`

### LOW Priority

- [ ] **Ledger should use actual paid amount**
  - File: `supabase/functions/stripe-webhook/index.ts`
  - Issue: Uses `community.price_cents` instead of `session.amount_total`
  - Impact: Over-reporting when discounts applied

- [ ] **Add multi-currency support**
  - Multiple files
  - Currently hardcoded to EUR

### ALREADY FIXED ✅

- [x] Activation fee UI shows €9.90 (was €2.90)
- [x] `creator_billing` auto-init trigger added
- [x] Cron jobs configured in GitHub Actions
- [x] `CRON_SECRET` set in Supabase and GitHub
- [x] Community creation plan limits enforced
- [x] Course creation plan limits enforced

---

## 12) Recommended Fix Order

1. **Community subscription webhook** - Prevents data corruption
2. **Course purchase enrollment** - Breaks user flow
3. **Funds model decision** - Architecture choice, affects multiple files
4. **billing_plans price IDs** - Blocks plan upgrades
5. **Dispute handler** - Chargebacks won't process correctly
6. **Community renewal crediting** - Creators lose recurring revenue
7. **Student Plus webhook** - Student Plus broken end-to-end
8. Remaining items as time permits

---

## 13) Option A Architecture: Destination Charges (SELECTED)

### Decision: Keep Destination Charges, Simplify Balance System

With destination charges, Stripe handles fund distribution immediately:
```
Student Pays €100
    ↓
Stripe splits automatically:
    → Platform: €6.90 (application_fee)
    → Creator Connect: €93.10 (transferred instantly)
    → Stripe fees: deducted from creator's share
```

### What This Means

| Aspect | Old Design | New Design (Option A) |
|--------|------------|----------------------|
| **Fund flow** | Platform holds → 7-day pending → weekly payout | Stripe transfers instantly to creator |
| **Creator gets paid** | Weekly batch payout | Immediately (Stripe handles it) |
| **Pending period** | 7 days in our DB | None (Stripe's own pending) |
| **Reserve (10%)** | Tracked in `reserved_balance_cents` | Stripe's built-in Connect reserve |
| **Withdrawals** | Via our `creator-withdrawal` endpoint | Creator uses Stripe Dashboard directly |
| **Chargebacks** | Deduct from our balance tracking | Stripe debits creator's Connect account |

### Components to KEEP

| Component | Purpose |
|-----------|---------|
| `creator_sales` table | Revenue reporting, analytics, audit trail |
| `balance_transactions` table | Audit trail (simplified - just records, no balance management) |
| `creator_billing` columns | `total_earned_cents`, `total_paid_out_cents` for lifetime stats |
| Dispute webhook handlers | Track chargebacks for reporting (not balance management) |
| Connect onboarding | Still needed for creators to receive funds |

### Components to SIMPLIFY/REMOVE

| Component | Action | Reason |
|-----------|--------|--------|
| `pending_balances` table | Stop using | Stripe handles pending |
| `pending_balance_cents` | Stop updating | Not managing funds |
| `available_balance_cents` | Stop updating | Creator withdraws via Stripe |
| `reserved_balance_cents` | Stop updating | Stripe manages reserves |
| `negative_balance_cents` | Keep for chargeback tracking | Still need to track debts |
| `release-pending-balances` cron | Remove/disable | Not needed |
| `process-payouts` cron | Remove/disable | Not needed |
| `creator-withdrawal` endpoint | Deprecate | Creators use Stripe Dashboard |
| Balance UI in Billing Settings | Simplify | Show lifetime earned, link to Stripe Dashboard |

### Webhook Changes Required

**`checkout.session.completed` (community purchase):**
- ✅ KEEP: Create `creator_sales` record
- ✅ KEEP: Create `balance_transactions` audit record
- ❌ REMOVE: Credit `pending_balances`
- ❌ REMOVE: Update `pending_balance_cents`
- ❌ REMOVE: Update `reserved_balance_cents`
- ❌ REMOVE: Create `reserve_releases` record

**`invoice.paid` (community renewal):**
- ✅ ADD: Create `creator_sales` record for renewal
- ✅ ADD: Create `balance_transactions` audit record
- ❌ SKIP: Balance management

**`charge.dispute.created`:**
- ✅ KEEP: Create `balance_transactions` audit record (type: 'chargeback')
- ✅ KEEP: Update `negative_balance_cents` if creator owes platform
- ❌ REMOVE: Complex balance deduction logic (Stripe handles fund deduction)

### UI Changes Required

**Billing Settings Page:**
- Remove: "Available Balance", "Pending Balance", "Reserve" display
- Remove: "Withdraw" button (use Stripe Dashboard link instead)
- Keep: "Total Earned" lifetime stat
- Add: "Manage Payouts" button → Opens Stripe Express Dashboard

### Migration Path

1. Fix critical bugs first (subscription corruption, course enrollment)
2. Update webhook handlers (remove balance crediting)
3. Update UI (simplify balance display)
4. Disable cron jobs (or leave them - they'll just find nothing to process)
5. Keep tables for historical data (don't delete)

---

## 14) Implementation Progress

_Updated: 2026-01-17_

### ✅ COMPLETED FIXES

| Fix | File | Lines Changed | Status |
|-----|------|---------------|--------|
| **Community subscription webhook corruption** | `stripe-webhook/index.ts` | 478-500 | ✅ DEPLOYED |
| **Course purchase enrollment creation** | `stripe-webhook/index.ts` | 619-650 | ✅ DEPLOYED |
| **Option A simplification (remove balance tracking)** | `stripe-webhook/index.ts` | 928-971 | ✅ DEPLOYED |
| **billing_plans price IDs** | Database | SQL update | ✅ APPLIED |
| **Dispute handler column reference** | `stripe-webhook/index.ts` | 1092 | ✅ DEPLOYED |
| **Community renewal revenue crediting** | `stripe-webhook/index.ts` | 354-443 | ✅ DEPLOYED |
| **Student Plus checkout handler** | `stripe-webhook/index.ts` | 273-315 | ✅ DEPLOYED |
| **Student Plus subscription.created handler** | `stripe-webhook/index.ts` | 478-492 | ✅ DEPLOYED |
| **Student Plus subscription.updated handler** | `stripe-webhook/index.ts` | 530-543 | ✅ DEPLOYED |
| **Student Plus subscription.deleted handler** | `stripe-webhook/index.ts` | 572-583 | ✅ DEPLOYED |

### Fix Details

**1. Community Subscription Webhook Corruption**
Added check in `handleSubscriptionCreated` to skip community subscriptions:
```typescript
// Skip community subscriptions - they have community_id in metadata
if (metadata?.type === 'community_subscription' || metadata?.community_id) {
  console.log('Skipping community subscription - not a creator plan');
  return;
}
```

**2. Course Purchase Enrollment**
Added enrollment creation in `handlePaymentIntentSucceeded`:
```typescript
if (productType === 'course' && productId && buyerId) {
  // Check if enrollment exists (idempotency)
  // Create enrollment with status: 'active'
}
```

**3. Option A - Destination Charges**
Simplified `handleCommunityCheckoutComplete` to remove balance tracking:
- Removed: `pending_balances` crediting
- Removed: `pending_balance_cents`, `available_balance_cents`, `reserved_balance_cents` updates
- Kept: `creator_sales` for reporting
- Kept: `balance_transactions` for audit trail (simplified, all balance fields = 0)
- Kept: `total_earned_cents` for lifetime stats

**4. billing_plans Price IDs**
```sql
UPDATE billing_plans SET stripe_price_id = 'price_1SoVqmEHrm7Q2JIncZnyu9SY' WHERE tier = 'pro';
UPDATE billing_plans SET stripe_price_id = 'price_1SoVqmEHrm7Q2JInneH7wG9d' WHERE tier = 'scale';
```

**5. Dispute Handler Column**
Changed from `stripe_checkout_session_id` to `stripe_charge_id`:
```typescript
.or(`stripe_payment_intent_id.eq.${chargeId},stripe_charge_id.eq.${chargeId}`)
```

**6. Community Renewal Crediting**
Added community subscription renewal handling in `handleInvoicePaid`:
- Lookup membership by `stripe_subscription_id`
- Create `creator_sales` record for renewal
- Update `total_earned_cents`
- Create audit trail in `balance_transactions`

**7. Student Plus Handlers**
Added complete webhook handling for Student Plus subscriptions:
- `handleStudentPlusCheckoutComplete` - Updates `student_subscriptions` on checkout complete
- `handleSubscriptionCreated` - Handles Student Plus subscription creation
- `handleSubscriptionUpdated` - Handles status changes, period updates
- `handleSubscriptionDeleted` - Handles cancellation

### Edge Functions Deployed

```
✅ stripe-webhook - Deployed 2026-01-17
```

### Remaining Tasks (Lower Priority)

| Task | Priority | Status |
|------|----------|--------|
| Fix payout.paid handler Connect ID mapping | MEDIUM | Pending |
| Fix student-plus-checkout profile lookup | MEDIUM | Pending |
| Ledger should use actual paid amount | LOW | Pending |
| Add multi-currency support | LOW | Pending |
| Simplify Billing Settings UI (Option A) | LOW | Pending |
| Disable/remove cron jobs (not needed with Option A) | LOW | Optional |

### System State After Fixes

**Working Payment Flows:**
- ✅ Community purchase (one-time + subscription)
- ✅ Community subscription renewal crediting
- ✅ Course purchase with enrollment
- ✅ Student Plus subscription (full lifecycle)
- ✅ Creator plan subscriptions (isolated from community/student)
- ✅ Dispute/chargeback tracking

**Funds Model:**
- ✅ Option A: Destination charges (Stripe handles fund distribution)
- ✅ Creator receives funds immediately via Connect
- ✅ Audit trail maintained in `balance_transactions`
- ✅ Lifetime stats tracked in `total_earned_cents`

---

## 14) UI/UX Review (Payments)

This section focuses on whether the interfaces, screens, and flows are wired in a user-complete way for both creator and student payment experiences.

### 14.1 Creator-side UI/UX

**Activation fee onboarding (OnboardingPage)**
**Strengths:** Clear CTA, success + cancel states, and post-success redirect flow are present.
**Gaps:** Pricing still relies on translations to be accurate; no secondary confirmation if webhook delay causes the “success” state to outlive billing update.
- `src/features/billing/pages/OnboardingPage.tsx:70-110`
- `src/features/billing/pages/OnboardingPage.tsx:186-225`

**Billing settings (plan subscription + billing portal)**
**Strengths:** Consolidated view for plan, billing portal, payouts, and connect status; good use of status badges.
**Gaps:**
- Stripe return URLs (`/settings?tab=billing&success=true` or `canceled=true`) are not handled, so there is no confirmation UI after checkout.
- Billing portal opens in a new tab; if popup is blocked or user returns, no “portal opened” or recovery message.
- No success/error toast after a plan change or cancel/resume action (only generic inline error state).
- `src/features/billing/pages/BillingSettingsPage.tsx:152-168`
- `src/features/billing/pages/BillingSettingsPage.tsx:183-220`

**Connect onboarding (payouts)**
**Strengths:** Good status breakdown (charges enabled, payouts enabled, identity).
**Gaps:**
- The onboarding `returnUrl`/`refreshUrl` is passed to Stripe, but the page does not read query params or auto-refresh status. Users must manually refresh or click “Refresh”.
- `src/features/billing/pages/BillingSettingsPage.tsx:339-383`

**Payouts + balance**
**Strengths:** Balance breakdown and eligibility UI are clear; withdrawal blocker shows user-friendly messaging.
**Gaps:** No explicit success confirmation after withdrawal; relies on silent refresh.
- `src/features/billing/components/BalanceCard.tsx:120-200`

**Pricing page (plan selection)**
**Strengths:** Good plan comparison and break-even calculator.
**Gaps:** For logged-in non-creator users, redirect to `/settings` is abrupt without a dedicated explanation.
- `src/features/billing/pages/PricingPage.tsx:70-110`

---

### 14.2 Student-side UI/UX

**Community purchase (paid communities)**
**Strengths:** Join CTA shows clear pricing; error displayed inline; discount code wiring exists.
**Gaps:**
- After Stripe return (`/community/:id?success=true`), there is no success or “payment processing” UI.
- Membership is created as `pending` before checkout; `JoinButton` only checks for membership existence, so users can see “Go to community” even if payment is pending or failed.
- No auto-redirect into `/app/community` after paid checkout completes (unless the user manually clicks).
- `src/public-pages/communities/JoinButton.tsx:102-160`
- `src/public-pages/communities/CommunityLandingPage.tsx:148-200`

**Community subscription management (cancel)**
**Strengths:** Leave modal explains consequences and routes to Stripe portal when needed.
**Gaps:** No confirmation UI when returning from portal; user must infer cancellation status.
- `src/features/community/components/LeaveCommunityModal.tsx:88-116`

**Course purchase (Stripe Elements modal)**
**Strengths:** Inline modal checkout is clear; success message shown in modal.
**Gaps:**
- If a card requires redirect (3DS), the return URL is `/courses/:id?payment=success`, but the course page doesn’t display a confirmation banner or automatically refresh enrollment state.
- If user closes the modal mid-checkout, there is no “Resume payment” state.
- `src/features/courses/components/CoursePurchaseModal.tsx:149-214`
- `src/features/courses/CourseLMS.tsx:260-269`

**Student Plus subscription**
**Strengths:** Clear sales page and dashboard once subscribed; manage subscription button is present.
**Gaps:**
- Page is publicly accessible but not auth-gated. If signed out, `getSubscription()` throws and the error is not shown, so the user sees a normal sales page but checkout fails with a generic error.
- No CTA to sign in before subscribing.
- `src/features/studentPlus/components/StudentPlusPage.tsx:49-63`
- `src/features/studentPlus/hooks/useStudentSubscription.ts:24-60`

---

### 14.3 Flow wiring and experience consistency

- Return URL handling is inconsistent: only onboarding and Student Plus explicitly handle success/cancel states. Billing settings and community landing pages do not.
- Success confirmation patterns vary: course purchase uses an in-modal success state; community purchase relies on membership updates but has no UI confirmation; plan upgrade has no confirmation.
- Membership vs payment state mismatch: for paid communities, membership existence does not imply paid access. The UI should reflect `payment_status` (pending/paid/expired).
- Authentication UX gap: some payment flows (Student Plus, community paid checkout) don’t explicitly prompt unauthenticated users, leading to confusing errors.

---

### 14.4 UI/UX Readiness Summary

Mostly wired but inconsistent. Core screens exist for all payment journeys, but the end-to-end experience is uneven due to missing success/cancel handling, unclear post-payment states, and weak auth gating for student flows. These should be addressed before production to reduce support burden and confusion.

---

## 15) Claude Reviewer Validation of UI/UX Findings (2026-01-17)

### 15.1 Validation Summary

| Finding | Valid? | Priority | Notes |
|---------|--------|----------|-------|
| **Activation fee - pricing relies on translations** | ⚠️ PARTIAL | LOW | UI hardcodes €9.90 in OnboardingPage:260, only label uses translation |
| **Activation fee - no webhook delay confirmation** | ✅ VALID | LOW | Edge case - could add polling or optimistic UI |
| **Billing settings - return URLs not handled** | ✅ VALID | MEDIUM | No success/canceled param handling after Stripe redirect |
| **Billing settings - portal popup blocked** | ✅ VALID | LOW | Should add "portal opened" message and recovery option |
| **Billing settings - no toast after plan change** | ✅ VALID | MEDIUM | Actions complete silently - needs toast feedback |
| **Connect onboarding - no auto-refresh on return** | ✅ VALID | MEDIUM | Users must manually refresh after completing Stripe onboarding |
| **Payouts - no withdrawal confirmation** | ❌ MOOT | N/A | Option A simplification removes withdrawal UI - creators use Stripe Dashboard |
| **Pricing page - abrupt redirect** | ✅ VALID | LOW | Minor UX friction for non-creators |
| **Community purchase - no success UI after return** | ✅ VALID | HIGH | CommunityLandingPage only handles `action=join`, not `success=true/canceled=true` |
| **Community purchase - membership status mismatch** | ⚠️ PARTIAL | MEDIUM | Code checks `payment_status` in some places (LeaveCommunityModal:102) but JoinButton only checks membership existence |
| **Community purchase - no auto-redirect** | ✅ VALID | LOW | Minor UX improvement |
| **Community cancel - no portal confirmation** | ✅ VALID | LOW | User infers status from membership state |
| **Course purchase - 3DS return no confirmation** | ✅ VALID | MEDIUM | Return URL `/courses/:id?payment=success` not handled |
| **Course purchase - no resume payment** | ❌ INVALID | N/A | Edge case - abandoned carts are common, not a bug |
| **Student Plus - not auth-gated** | ✅ VALID | HIGH | Shows sales page when logged out, checkout fails silently |
| **Student Plus - no sign-in CTA** | ✅ VALID | HIGH | Should prompt unauthenticated users to sign in |

### 15.2 Overall Assessment

**Backend payment flows: PRODUCTION READY** (after previous fixes)
**Frontend UX: NEEDS POLISH** - Core flows work but lack feedback/confirmation patterns

The most critical UX gaps are:
1. **Student Plus auth gating** - Users see checkout button when logged out, fails silently
2. **Community purchase success/cancel** - No confirmation after Stripe return
3. **Course purchase 3DS return** - No confirmation after redirect-based auth

---

## 16) UI/UX Production Readiness Checklist

### HIGH Priority (User-facing friction/confusion)

- [ ] **Community landing page - handle success/cancel params**
  - File: `src/public-pages/communities/CommunityLandingPage.tsx`
  - Issue: Returns from Stripe have `?success=true` or `?canceled=true` but no UI
  - Fix: Add success/cancel banner like StudentPlusPage (lines 26-46)
  - Auto-refresh membership status on success

- [ ] **Student Plus - add auth gating/CTA**
  - File: `src/features/studentPlus/components/StudentPlusPage.tsx`
  - Issue: Checkout button visible when logged out, fails with generic error
  - Fix: Check auth state, show "Sign in to subscribe" CTA instead of checkout button
  - Or: Show sign-in modal when clicking Subscribe while logged out

- [ ] **Course purchase - handle 3DS return**
  - File: `src/features/courses/CourseLMS.tsx`
  - Issue: Return URL `/courses/:id?payment=success` has no handler
  - Fix: Read searchParams, show success banner, refresh enrollment state

- [ ] **JoinButton - check payment_status, not just membership existence**
  - File: `src/public-pages/communities/JoinButton.tsx`
  - Issue: Line 96 checks `!!membership` but should check `membership.payment_status === 'paid'`
  - Fix: Fetch payment_status, show appropriate CTA for pending/failed payments

### MEDIUM Priority (Polish for professional UX)

- [ ] **Billing settings - handle return URL params**
  - File: `src/features/billing/pages/BillingSettingsPage.tsx`
  - Issue: No handling of `?success=true` after plan subscription checkout
  - Fix: Add useSearchParams, show toast on success/cancel

- [ ] **Billing settings - add toast feedback after actions**
  - File: `src/features/billing/pages/BillingSettingsPage.tsx`
  - Issue: Plan change, cancel, resume have no visible success feedback
  - Fix: Add toast notifications using react-hot-toast or similar

- [ ] **Connect onboarding - auto-refresh on return**
  - File: `src/features/billing/pages/BillingSettingsPage.tsx`
  - Issue: After completing Stripe Connect onboarding, status doesn't refresh
  - Fix: Check URL params for Connect return, trigger status refresh

- [ ] **Option A UI simplification**
  - File: `src/features/billing/components/BalanceCard.tsx`
  - File: `src/features/billing/pages/BillingSettingsPage.tsx`
  - Change: Remove withdrawal button, pending/available/reserve display
  - Change: Show "Total Earned" + "Manage Payouts" button → Stripe Dashboard link

### LOW Priority (Nice to have)

- [ ] **Billing portal - add recovery message**
  - Issue: If popup blocked, user stuck
  - Fix: Add "Click here if portal didn't open" fallback link

- [ ] **Pricing page - smoother non-creator redirect**
  - Issue: Abrupt redirect to /settings for logged-in non-creators
  - Fix: Show message explaining redirect before navigating

- [ ] **Community purchase - auto-redirect after success**
  - Issue: User must manually click to enter community after successful purchase
  - Fix: Auto-navigate to `/app/community` after showing success message

- [ ] **Community cancel - portal return confirmation**
  - Issue: No confirmation UI when returning from cancellation portal
  - Fix: Check for portal return, show confirmation message

---

## 17) Recommended Fix Order for UI/UX

**Phase 1: Critical Auth & Payment Feedback (HIGH)**
1. Student Plus auth gating - prevents silent failures
2. Community landing success/cancel handling - confirms payment
3. Course 3DS return handling - confirms payment
4. JoinButton payment_status check - accurate membership state

**Phase 2: Creator Dashboard Polish (MEDIUM)**
5. Billing settings return URL handling
6. Billing settings toast feedback
7. Connect onboarding auto-refresh
8. Option A UI simplification

**Phase 3: Minor Polish (LOW)**
9. Billing portal recovery message
10. Pricing page redirect UX
11. Community auto-redirect
12. Community portal confirmation

---

## 18) Implementation Snippets

### Student Plus Auth Gating (HIGH Priority)

```tsx
// src/features/studentPlus/components/StudentPlusPage.tsx
// Add auth check in non-subscriber view (around line 94)

const { user } = useAuth(); // Add this import

// Before the subscribe button, add auth check:
{!user ? (
  <button
    onClick={() => navigate('/signin?return=/student-plus')}
    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 px-8 rounded-xl font-semibold text-lg"
  >
    {t('studentPlus.page.signInToSubscribe')}
  </button>
) : (
  <button
    onClick={handleSubscribe}
    disabled={isCheckingOut}
    // ... existing button code
  >
    {/* ... existing content */}
  </button>
)}
```

### Community Landing Success/Cancel (HIGH Priority)

```tsx
// src/public-pages/communities/CommunityLandingPage.tsx
// Add after line 125 (state declarations)

const [showSuccessMessage, setShowSuccessMessage] = useState(false);
const [showCancelMessage, setShowCancelMessage] = useState(false);

// Add new useEffect for handling success/cancel
useEffect(() => {
  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  if (success === 'true') {
    setShowSuccessMessage(true);
    // Clear params and redirect to app after delay
    setTimeout(() => {
      navigate('/app/community');
    }, 2000);
  }

  if (canceled === 'true') {
    setShowCancelMessage(true);
    // Clear params
    window.history.replaceState({}, '', `/community/${communityId}`);
    setTimeout(() => setShowCancelMessage(false), 5000);
  }
}, [searchParams, communityId, navigate]);

// Add banners in JSX (after the header section)
{showSuccessMessage && (
  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
    <p className="font-semibold text-emerald-800">
      {t('publicCommunities.landing.paymentSuccess')}
    </p>
    <p className="text-emerald-700 text-sm">
      {t('publicCommunities.landing.redirecting')}
    </p>
  </div>
)}

{showCancelMessage && (
  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
    <p className="font-semibold text-amber-800">
      {t('publicCommunities.landing.paymentCanceled')}
    </p>
  </div>
)}
```

### JoinButton Payment Status Check (HIGH Priority)

```tsx
// src/public-pages/communities/JoinButton.tsx
// Modify checkMembership effect (around line 88)

const [membershipStatus, setMembershipStatus] = useState<{
  isMember: boolean;
  paymentStatus?: string;
} | null>(null);

useEffect(() => {
  const checkMembership = async () => {
    if (!user) {
      setMembershipStatus(null);
      return;
    }

    const membership = await getMembership(user.id, communityId);
    if (membership) {
      // Check both existence AND payment status
      setMembershipStatus({
        isMember: membership.payment_status === 'paid' || membership.payment_status === null, // null = free community
        paymentStatus: membership.payment_status,
      });
    } else {
      setMembershipStatus({ isMember: false });
    }
  };

  checkMembership();
}, [user, communityId]);

// Update button logic to handle pending payments
const getButtonText = () => {
  if (membershipStatus?.paymentStatus === 'pending') {
    return t('publicCommunities.join.paymentPending');
  }
  // ... rest of existing logic
};
```

---

## 19) Production Status Summary

### Backend Payment Flows ✅ READY
- Community purchase (one-time + subscription)
- Community subscription renewal crediting
- Course purchase with enrollment
- Student Plus subscription (full lifecycle)
- Creator plan subscriptions (isolated)
- Dispute/chargeback tracking

### Frontend UI/UX ⚠️ NEEDS POLISH (estimated 2-3 hours)
- 4 HIGH priority items (auth gating, payment confirmations)
- 4 MEDIUM priority items (toast feedback, auto-refresh)
- 4 LOW priority items (minor polish)

### Recommended Timeline
1. Deploy backend fixes (DONE ✅)
2. Implement HIGH priority UI fixes (before launch)
3. Implement MEDIUM priority as fast-follow
4. LOW priority in future polish sprint
