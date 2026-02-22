# Comprehensive Payment Test Checklist

> **Test Mode Status**: All tests should run against Stripe TEST mode
> **Frontend**: pk_test_51L8YMoFbO001Rr4n...
> **Backend**: sk_test_... (Supabase secrets)

---

## Test Cards Reference

| Card Number | Behavior |
|-------------|----------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 3220` | 3D Secure required |
| `4000 0000 0000 9995` | Decline (insufficient funds) |
| `4000 0000 0000 0002` | Decline (generic) |

---

## Part 1: Creator Payment Flows

### 1.1 Creator Activation Fee (€2.90 one-time)

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| C-ACT-01 | New creator sees onboarding page | Shows €2.90 activation fee required | ⬜ |
| C-ACT-02 | Click "Activate" redirects to Stripe | Opens Stripe Checkout with correct amount | ⬜ |
| C-ACT-03 | Complete payment with success card | Redirects back with `success=true`, creator activated | ⬜ |
| C-ACT-04 | Payment with declined card | Shows decline error on Stripe page | ⬜ |
| C-ACT-05 | Cancel checkout | Redirects back with `canceled=true` | ⬜ |
| C-ACT-06 | Webhook processes `checkout.session.completed` | `creator_billing.is_activated = true` | ⬜ |
| C-ACT-07 | Already-activated creator visits onboarding | Redirects to dashboard or shows activated state | ⬜ |

### 1.2 Creator Subscription Plans (Pro €30/mo, Scale €99/mo)

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| C-SUB-01 | Billing page shows current plan (Starter) | Displays Starter tier with 6.9% fee | ⬜ |
| C-SUB-02 | Billing page shows upgrade options | Pro €30 (3.9%), Scale €99 (1.9%) visible | ⬜ |
| C-SUB-03 | Click "Upgrade to Pro" | Opens Stripe Checkout for subscription | ⬜ |
| C-SUB-04 | Complete Pro subscription | Webhook updates `billing_plans` tier, shows active | ⬜ |
| C-SUB-05 | Access Stripe Billing Portal | Opens portal for managing subscription | ⬜ |
| C-SUB-06 | Cancel subscription in portal | Cancels at period end, updates status | ⬜ |
| C-SUB-07 | Upgrade from Pro to Scale | Prorated upgrade processed correctly | ⬜ |
| C-SUB-08 | Subscription renewal webhook | `invoice.paid` renews subscription | ⬜ |
| C-SUB-09 | Failed renewal webhook | `invoice.payment_failed` marks past_due | ⬜ |

### 1.3 Creator Stripe Connect (Payout Setup)

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| C-CON-01 | Billing page shows payout setup section | "Set up payouts" or status indicator visible | ⬜ |
| C-CON-02 | Click "Setup Payouts" | Redirects to Stripe Connect onboarding | ⬜ |
| C-CON-03 | Complete Connect onboarding (test) | Returns with `?setup=complete`, account created | ⬜ |
| C-CON-04 | Connect account status updates | `creator_billing.stripe_account_status = 'active'` | ⬜ |
| C-CON-05 | Connected creator sees dashboard link | Link to Stripe Express Dashboard visible | ⬜ |
| C-CON-06 | Creator without Connect tries to sell | Error: "Set up payouts first" | ⬜ |

---

## Part 2: Student Payment Flows

### 2.1 Student Plus Subscription (€9.90/mo)

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| S-PLUS-01 | Student Plus page shows pricing | €9.90/month displayed with benefits | ⬜ |
| S-PLUS-02 | Non-subscriber sees "Subscribe" button | Button enabled and clickable | ⬜ |
| S-PLUS-03 | Click Subscribe opens Stripe Checkout | Checkout session with correct price | ⬜ |
| S-PLUS-04 | Complete subscription | `student_subscriptions.status = 'active'` | ⬜ |
| S-PLUS-05 | Subscriber sees loyalty dashboard | Shows current streak, milestones | ⬜ |
| S-PLUS-06 | Cancel checkout returns | `?canceled=true` parameter handled | ⬜ |
| S-PLUS-07 | Webhook handles renewal | `invoice.paid` updates `current_period_end` | ⬜ |
| S-PLUS-08 | Webhook handles cancellation | `customer.subscription.deleted` updates status | ⬜ |

### 2.2 Course Enrollment (Free & Paid)

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| S-CRS-01 | View free course shows "Enroll" | No price displayed, direct enroll | ⬜ |
| S-CRS-02 | Enroll in free course | Creates enrollment record, no payment | ⬜ |
| S-CRS-03 | View paid course shows price | Price in EUR displayed on course page | ⬜ |
| S-CRS-04 | Click "Enroll" on paid course | Opens payment flow (Checkout or modal) | ⬜ |
| S-CRS-05 | Complete paid enrollment | `enrollments.payment_status = 'paid'` | ⬜ |
| S-CRS-06 | Already enrolled shows "Continue" | No purchase option, shows progress | ⬜ |

---

## Part 3: Community Monetization

### 3.1 Paid Community Access (One-Time)

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| S-COM-01 | Public landing page shows pricing | One-time price displayed (e.g., €49) | ⬜ |
| S-COM-02 | Click "Join" redirects to Stripe | Stripe Checkout with `mode: 'payment'` | ⬜ |
| S-COM-03 | Complete payment | `memberships.payment_status = 'paid'` | ⬜ |
| S-COM-04 | Webhook creates `community_purchases` record | Sale recorded with platform fee | ⬜ |
| S-COM-05 | Webhook creates `creator_sales` record | Creator earnings tracked | ⬜ |
| S-COM-06 | Platform fee calculated correctly | Based on creator's plan tier | ⬜ |
| S-COM-07 | User can access community after payment | Membership grants full access | ⬜ |
| S-COM-08 | Cancel checkout | Returns to landing, no membership created | ⬜ |

### 3.2 Paid Community Access (Monthly Subscription)

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| S-COM-10 | Monthly community shows "/month" pricing | Subscription indicator visible | ⬜ |
| S-COM-11 | Click "Join" creates subscription | Stripe Checkout with `mode: 'subscription'` | ⬜ |
| S-COM-12 | Complete subscription | `memberships.stripe_subscription_id` populated | ⬜ |
| S-COM-13 | Subscription renewal webhook | `invoice.paid` extends `expires_at` | ⬜ |
| S-COM-14 | Subscription canceled | `memberships.payment_status = 'canceled'` | ⬜ |
| S-COM-15 | Access revoked after subscription ends | User loses community access | ⬜ |
| S-COM-16 | Re-subscribe after cancellation | New subscription created, access restored | ⬜ |

### 3.3 Free Community Access

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| S-COM-20 | Free community shows "Join Free" | No price displayed | ⬜ |
| S-COM-21 | Click "Join Free" creates membership | Membership with `payment_status = 'none'` | ⬜ |
| S-COM-22 | No Stripe redirect for free community | Instant join, no checkout | ⬜ |

---

## Part 4: Discount Codes (NEW)

### 4.1 Discount Code Validation

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| D-VAL-01 | Valid code accepted | Checkout shows discount applied | ⬜ |
| D-VAL-02 | Invalid/nonexistent code rejected | Error: "This discount code doesn't exist" | ⬜ |
| D-VAL-03 | Inactive code rejected | Error: "This discount code is no longer active" | ⬜ |
| D-VAL-04 | Expired code rejected | Error: "This discount code has expired" | ⬜ |
| D-VAL-05 | Not-yet-valid code rejected | Error: "This discount code is not yet valid" | ⬜ |
| D-VAL-06 | Max-uses-reached code rejected | Error: "This discount code has reached its usage limit" | ⬜ |
| D-VAL-07 | Student-targeted code used by wrong user | Error: "This discount code is not valid for your account" | ⬜ |
| D-VAL-08 | Community-targeted code used on wrong community | Error: "This discount code isn't valid for this community" | ⬜ |
| D-VAL-09 | Code from different creator rejected | Error: "This discount code isn't valid for this community" | ⬜ |
| D-VAL-10 | Code already used by student rejected | Error: "You've already used this discount code" | ⬜ |
| D-VAL-11 | Case-insensitive code lookup | "SAVE20" = "save20" = "Save20" | ⬜ |

### 4.2 Stripe Coupon Integration

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| D-STR-01 | First use of code creates Stripe coupon | `stripe_coupon_id` saved to `discount_codes` | ⬜ |
| D-STR-02 | Subsequent uses reuse existing coupon | No duplicate coupon created | ⬜ |
| D-STR-03 | One-time discount (duration_months = 1) | Stripe coupon with `duration: 'once'` | ⬜ |
| D-STR-04 | Forever discount (duration_months = null) | Stripe coupon with `duration: 'forever'` | ⬜ |
| D-STR-05 | Repeating discount (duration_months > 1) | Stripe coupon with `duration: 'repeating'` | ⬜ |
| D-STR-06 | Checkout session includes coupon | `discounts: [{ coupon: <id> }]` in session | ⬜ |

### 4.3 Discount Calculations

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| D-CALC-01 | Percentage discount calculated correctly | 50% off €100 = €50 | ⬜ |
| D-CALC-02 | Platform fee on discounted price | Fee based on €50, not €100 | ⬜ |
| D-CALC-03 | Checkout metadata includes original/discount amounts | `original_amount_cents`, `discount_amount_cents` tracked | ⬜ |

### 4.4 Discount Redemption Tracking

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| D-TRK-01 | Successful checkout creates redemption record | `discount_redemptions` row created | ⬜ |
| D-TRK-02 | Redemption includes amounts | `original_amount_cents`, `discount_amount_cents`, `final_amount_cents` | ⬜ |
| D-TRK-03 | `current_uses` incremented on redemption | `discount_codes.current_uses += 1` | ⬜ |
| D-TRK-04 | Canceled checkout doesn't create redemption | No record on abandonment | ⬜ |
| D-TRK-05 | Failed payment doesn't create redemption | Only on successful `checkout.session.completed` | ⬜ |

### 4.5 Discount + Subscription Combinations

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| D-SUB-01 | One-time discount on monthly community | First month discounted, then full price | ⬜ |
| D-SUB-02 | Forever discount on monthly community | All renewals discounted | ⬜ |
| D-SUB-03 | 3-month discount on monthly community | 3 months discounted, then full price | ⬜ |

---

## Part 5: Webhook Processing

### 5.1 Core Webhook Events

| ID | Event Type | Handler | Status |
|----|------------|---------|--------|
| W-01 | `checkout.session.completed` | Creates purchase, activates membership | ⬜ |
| W-02 | `invoice.paid` | Renews subscriptions, records recurring sales | ⬜ |
| W-03 | `invoice.payment_failed` | Marks subscription past_due | ⬜ |
| W-04 | `customer.subscription.updated` | Handles upgrades/downgrades | ⬜ |
| W-05 | `customer.subscription.deleted` | Revokes access, marks canceled | ⬜ |
| W-06 | `account.updated` (Connect) | Updates creator account status | ⬜ |

### 5.2 Webhook Reliability

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| W-REL-01 | Idempotency check | Duplicate events ignored via `webhook_events` table | ⬜ |
| W-REL-02 | Signature verification | Invalid signatures rejected (401) | ⬜ |
| W-REL-03 | Unknown event types | Returns 200 (not processed, not error) | ⬜ |
| W-REL-04 | Missing metadata handled | Graceful degradation, logged error | ⬜ |

---

## Part 6: Platform Fee Verification

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| FEE-01 | Starter creator sale (6.9%) | €100 sale → €6.90 platform fee | ⬜ |
| FEE-02 | Pro creator sale (3.9%) | €100 sale → €3.90 platform fee | ⬜ |
| FEE-03 | Scale creator sale (1.9%) | €100 sale → €1.90 platform fee | ⬜ |
| FEE-04 | Fee in Stripe Connect payout | `application_fee_amount` correct | ⬜ |
| FEE-05 | Fee recorded in `creator_sales` | `platform_fee_cents` matches calculation | ⬜ |
| FEE-06 | Discounted sale fee calculation | Fee on post-discount amount | ⬜ |

---

## Part 7: Edge Cases & Error Handling

| ID | Test Case | Expected Result | Status |
|----|-----------|-----------------|--------|
| E-01 | Creator without Connect tries to sell | Error: "Creator has not set up payouts" | ⬜ |
| E-02 | Creator with inactive Connect tries to sell | Error: "Creator payout account is not active" | ⬜ |
| E-03 | Student already has paid membership | Error: "You already have access to this community" | ⬜ |
| E-04 | Free community purchase attempted | Error: "This community is free. Use the join endpoint" | ⬜ |
| E-05 | Missing JWT on checkout endpoint | 401 Unauthorized | ⬜ |
| E-06 | Invalid community ID | 400 "Community not found" | ⬜ |
| E-07 | Community price not configured | 400 "Community price not configured" | ⬜ |

---

## Test Execution Summary

| Category | Total Tests | Priority |
|----------|-------------|----------|
| Creator Activation | 7 | P0 |
| Creator Subscription | 9 | P0 |
| Creator Connect | 6 | P1 |
| Student Plus | 8 | P1 |
| Course Enrollment | 6 | P1 |
| Community One-Time | 8 | P0 |
| Community Monthly | 7 | P0 |
| Community Free | 3 | P2 |
| Discount Validation | 11 | P0 |
| Discount Stripe Integration | 6 | P0 |
| Discount Calculations | 3 | P0 |
| Discount Redemption Tracking | 5 | P0 |
| Discount + Subscriptions | 3 | P1 |
| Webhooks | 10 | P0 |
| Platform Fees | 6 | P1 |
| Edge Cases | 7 | P1 |
| **TOTAL** | **105** | |

---

## Quick Test Commands

```bash
# Run all payment E2E tests
npm run test:headed

# Run creator tests only
npm run test:creator

# Run student tests only
npm run test:student

# View test report
npm run test:report
```

---

## Database Verification Queries

After running tests, verify data with these queries:

```sql
-- Check creator billing status
SELECT c.email, cb.is_activated, cb.stripe_account_status, bp.tier
FROM profiles c
JOIN creator_billing cb ON cb.creator_id = c.id
LEFT JOIN billing_plans bp ON bp.id = cb.plan_id
WHERE c.role = 'creator';

-- Check community purchases
SELECT
  cp.id,
  co.name as community,
  p.email as buyer,
  cp.amount_cents,
  cp.platform_fee_cents,
  cp.status,
  cp.created_at
FROM community_purchases cp
JOIN communities co ON co.id = cp.community_id
JOIN profiles p ON p.id = cp.buyer_id
ORDER BY cp.created_at DESC;

-- Check discount redemptions
SELECT
  dc.code,
  dc.discount_percent,
  p.email as student,
  dr.original_amount_cents,
  dr.discount_amount_cents,
  dr.final_amount_cents,
  dr.redeemed_at
FROM discount_redemptions dr
JOIN discount_codes dc ON dc.id = dr.discount_code_id
JOIN profiles p ON p.id = dr.student_id
ORDER BY dr.redeemed_at DESC;

-- Check membership payment statuses
SELECT
  m.id,
  c.name as community,
  p.email as member,
  m.payment_status,
  m.paid_at,
  m.expires_at
FROM memberships m
JOIN communities c ON c.id = m.community_id
JOIN profiles p ON p.id = m.user_id
WHERE m.payment_status != 'none'
ORDER BY m.created_at DESC;

-- Check webhook events processed
SELECT
  stripe_event_id,
  event_type,
  processed,
  created_at
FROM webhook_events
ORDER BY created_at DESC
LIMIT 20;
```
