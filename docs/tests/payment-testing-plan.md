# Payment System Testing Plan

**Created:** 2025-12-30
**Status:** Ready for Testing
**Environment:** Stripe Test Mode + Live Mode

---

## Overview

This document outlines all payment flows that need to be tested to validate the Creator Club payment system is fully functional. Tests cover both **Creator** and **Student** payment journeys.

### Test Environment Setup

**Stripe Test Cards:**
| Card Number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 3220` | 3D Secure required |
| `4000 0000 0000 9995` | Decline (insufficient funds) |
| `4000 0000 0000 0002` | Decline (generic) |
| `4000 0025 0000 3155` | Requires authentication |

**Test CVV:** Any 3 digits (e.g., `123`)
**Test Expiry:** Any future date (e.g., `12/34`)
**Test ZIP:** Any 5 digits (e.g., `12345`)

---

## Part 1: Creator Payment Flows

### 1.1 Activation Fee Payment

**Flow:** New creator signs up → Pays €2.90 activation fee → Account activated

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| C-ACT-01 | Successful activation | 1. Sign up as creator<br>2. Redirect to OnboardingPage<br>3. Enter test card `4242...`<br>4. Complete payment | - Stripe checkout succeeds<br>- `activation_fee_paid = true` in DB<br>- Redirect to dashboard |
| C-ACT-02 | Declined card | 1. Sign up as creator<br>2. Enter declined card `4000...9995`<br>3. Attempt payment | - Payment fails<br>- Error message shown<br>- User stays on onboarding |
| C-ACT-03 | 3D Secure flow | 1. Use 3DS card `4000...3220`<br>2. Complete 3DS challenge | - 3DS modal appears<br>- After authentication, payment succeeds |
| C-ACT-04 | Cancel checkout | 1. Start checkout<br>2. Click back/cancel | - Returns to onboarding<br>- No charge made |

**Database Validations:**
```sql
-- After successful activation
SELECT
  activation_fee_paid,
  activation_fee_paid_at,
  stripe_customer_id
FROM creator_billing
WHERE creator_id = '<user_id>';
-- Expected: activation_fee_paid = true, timestamp set, customer_id populated
```

---

### 1.2 Creator Plan Subscription

**Flow:** Creator upgrades from Starter → Pro or Scale plan

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| C-SUB-01 | Upgrade Starter → Pro | 1. Go to Billing Settings<br>2. Click "Upgrade to Pro"<br>3. Complete checkout | - Subscription created<br>- Plan updated to 'pro'<br>- `stripe_subscription_id` set |
| C-SUB-02 | Upgrade Starter → Scale | 1. Select Scale plan<br>2. Complete checkout | - Subscription at €99/month<br>- Plan updated to 'scale' |
| C-SUB-03 | Upgrade Pro → Scale | 1. Already on Pro<br>2. Upgrade to Scale | - Proration applied<br>- Immediate upgrade |
| C-SUB-04 | Downgrade Scale → Pro | 1. On Scale plan<br>2. Downgrade to Pro | - Change scheduled for period end<br>- `cancel_at_period_end` or scheduled change |
| C-SUB-05 | Cancel subscription | 1. On paid plan<br>2. Click Cancel<br>3. Confirm | - `cancel_at_period_end = true`<br>- Access until period end |
| C-SUB-06 | Resume canceled sub | 1. Canceled but not expired<br>2. Click Resume | - Subscription reactivated<br>- `cancel_at_period_end = false` |

**Database Validations:**
```sql
-- Check subscription status
SELECT
  b.status,
  b.stripe_subscription_id,
  b.current_period_start,
  b.current_period_end,
  b.cancel_at_period_end,
  p.tier,
  p.name
FROM creator_billing b
JOIN billing_plans p ON b.plan_id = p.id
WHERE b.creator_id = '<user_id>';
```

---

### 1.3 Stripe Connect Onboarding (Creator Payouts)

**Flow:** Creator sets up Stripe Connect to receive payouts from student purchases

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| C-CON-01 | Start Connect onboarding | 1. Go to Billing Settings<br>2. Click "Setup Payouts"<br>3. Redirected to Stripe | - Connect account created<br>- `stripe_account_id` saved<br>- Onboarding link generated |
| C-CON-02 | Complete onboarding | 1. Fill Stripe form<br>2. Submit verification | - `stripe_account_status = 'active'`<br>- `chargesEnabled = true`<br>- `payoutsEnabled = true` |
| C-CON-03 | Incomplete onboarding | 1. Start but don't finish<br>2. Return to app | - Status shows incomplete<br>- Resume button available |
| C-CON-04 | Access Express Dashboard | 1. Complete onboarding<br>2. Click "View Dashboard" | - Redirects to Stripe Express Dashboard |

**Database Validations:**
```sql
-- Check Connect status
SELECT
  stripe_account_id,
  stripe_account_status
FROM creator_billing
WHERE creator_id = '<user_id>';
```

**API Validation (via Stripe Dashboard or CLI):**
```bash
stripe accounts retrieve acct_xxx --live
# Check: charges_enabled, payouts_enabled, details_submitted
```

---

### 1.4 First Sale Trigger (Monthly Fee Activation)

**Flow:** Creator on Pro/Scale makes first sale → Monthly subscription starts

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| C-SALE-01 | First sale triggers fee | 1. Creator on Pro plan<br>2. Student buys course<br>3. Payment succeeds | - `has_first_sale = true`<br>- `first_sale_at` timestamp set<br>- `monthly_fee_active = true` |
| C-SALE-02 | Starter no monthly fee | 1. Creator on Starter<br>2. Student buys course | - Sale recorded<br>- No subscription created<br>- Platform fee (6.9%) deducted |

**Database Validations:**
```sql
-- After first sale
SELECT
  has_first_sale,
  first_sale_at,
  monthly_fee_active
FROM creator_billing
WHERE creator_id = '<creator_id>';

-- Check sale record
SELECT * FROM creator_sales
WHERE creator_id = '<creator_id>'
ORDER BY created_at DESC LIMIT 1;
```

---

## Part 2: Student Payment Flows

### 2.1 Course Purchase (One-time Payment)

**Flow:** Student buys a paid course from a creator

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| S-CRS-01 | Purchase paid course | 1. View course (price: €50)<br>2. Click "Enroll"<br>3. Complete payment | - Payment succeeds<br>- Enrollment created<br>- Creator receives net amount<br>- Platform fee deducted |
| S-CRS-02 | Enroll free course | 1. View free course<br>2. Click "Enroll" | - Immediate enrollment<br>- No payment modal |
| S-CRS-03 | Purchase with 3DS | 1. Use 3DS card<br>2. Complete authentication | - 3DS flow works<br>- Enrollment after success |
| S-CRS-04 | Failed payment | 1. Use declined card<br>2. Attempt purchase | - Error shown<br>- No enrollment created |

**Platform Fee Calculation:**
```
Sale Amount: €50.00
Creator Plan: Pro (3.9% fee)
Platform Fee: €50 × 3.9% = €1.95
Stripe Fee: ~€1.45 (2.9% + €0.25)
Creator Net: €50 - €1.95 - €1.45 = €46.60
```

**Database Validations:**
```sql
-- Check sale record
SELECT
  product_name,
  sale_amount_cents,
  platform_fee_cents,
  stripe_fee_cents,
  net_amount_cents,
  status
FROM creator_sales
WHERE buyer_id = '<student_id>';

-- Check enrollment
SELECT * FROM enrollments
WHERE user_id = '<student_id>' AND course_id = '<course_id>';
```

---

### 2.2 Student Plus Subscription

**Flow:** Student subscribes to Student Plus (€9.90/month)

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| S-PLUS-01 | Subscribe to Plus | 1. Go to Student Plus page<br>2. Click Subscribe<br>3. Complete checkout | - Subscription active<br>- `status = 'active'`<br>- Access to perks |
| S-PLUS-02 | Checkout success redirect | 1. Complete checkout<br>2. Redirect with ?success=true | - Success message shown<br>- Subscription confirmed |
| S-PLUS-03 | Cancel Plus subscription | 1. Active Plus subscriber<br>2. Access billing portal<br>3. Cancel | - Cancellation scheduled<br>- Access until period end |
| S-PLUS-04 | Resubscribe after cancel | 1. Previously canceled<br>2. Subscribe again | - New subscription created |
| S-PLUS-05 | Payment failure | 1. Card declines on renewal<br>2. Webhook received | - Status → 'past_due'<br>- Grace period starts |

**Database Validations:**
```sql
-- Check Student Plus subscription
SELECT
  status,
  stripe_subscription_id,
  stripe_customer_id,
  current_period_start,
  current_period_end,
  loyalty_months
FROM student_plus_subscriptions
WHERE user_id = '<student_id>';
```

---

### 2.3 Student Plus Loyalty Rewards

**Flow:** Long-term subscribers earn milestone rewards

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| S-LOY-01 | 3-month milestone | 1. Active for 3 months<br>2. Check rewards | - `loyalty_months = 3`<br>- Rewards unlocked |
| S-LOY-02 | 6-month milestone | 1. Active for 6 months | - Additional rewards |
| S-LOY-03 | 12-month milestone | 1. Active for 12 months | - Premium rewards unlocked |

---

## Part 3: Webhook Event Testing

### 3.1 Webhook Events to Test

| Event Type | Trigger | Expected Handling |
|------------|---------|-------------------|
| `checkout.session.completed` | Successful checkout | Create/update subscription, enrollment |
| `invoice.paid` | Subscription renewal | Update period dates, log transaction |
| `invoice.payment_failed` | Failed renewal | Update status to 'past_due' |
| `customer.subscription.created` | New subscription | Sync subscription to DB |
| `customer.subscription.updated` | Plan change | Update plan in DB |
| `customer.subscription.deleted` | Cancellation | Mark as canceled |
| `payment_intent.succeeded` | Course purchase | Create enrollment, record sale |
| `payment_intent.payment_failed` | Failed purchase | Log failure |
| `account.updated` | Connect status change | Update Connect status |
| `payout.paid` | Creator payout | Log payout transaction |
| `payout.failed` | Payout failure | Alert, log failure |

### 3.2 Webhook Testing Commands

**Using Stripe CLI:**
```bash
# Listen to webhooks locally
stripe listen --forward-to https://znqesarsluytxhuiwfkt.supabase.co/functions/v1/stripe-webhook

# Trigger specific events
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger customer.subscription.updated
stripe trigger payment_intent.succeeded
```

**Database Validation After Webhook:**
```sql
-- Check webhook was processed
SELECT
  stripe_event_id,
  event_type,
  processed,
  processed_at,
  error
FROM webhook_events
ORDER BY created_at DESC LIMIT 10;
```

---

## Part 4: E2E Test Specifications

### 4.1 Test File Structure

```
tests/
├── e2e/
│   ├── payments/
│   │   ├── creator-activation.spec.ts
│   │   ├── creator-subscription.spec.ts
│   │   ├── creator-connect.spec.ts
│   │   ├── student-course-purchase.spec.ts
│   │   ├── student-plus.spec.ts
│   │   └── webhooks.spec.ts
│   └── fixtures/
│       ├── test-users.ts
│       └── stripe-mocks.ts
```

### 4.2 E2E Test: Creator Activation Flow

```typescript
// tests/e2e/payments/creator-activation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Creator Activation Payment', () => {
  test('C-ACT-01: Successful activation with valid card', async ({ page }) => {
    // 1. Sign up as new creator
    await page.goto('/signup');
    await page.fill('[name="email"]', `test-${Date.now()}@example.com`);
    await page.fill('[name="password"]', 'TestPass123!');
    await page.click('[data-role="creator"]');
    await page.click('button[type="submit"]');

    // 2. Should redirect to onboarding
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.locator('h1')).toContainText('Activate Your Account');

    // 3. Click pay activation fee
    await page.click('button:has-text("Pay Activation Fee")');

    // 4. Stripe Checkout (in iframe or redirect)
    // Wait for Stripe checkout
    const stripeFrame = page.frameLocator('iframe[name*="stripe"]');
    await stripeFrame.locator('[name="cardNumber"]').fill('4242424242424242');
    await stripeFrame.locator('[name="cardExpiry"]').fill('1234');
    await stripeFrame.locator('[name="cardCvc"]').fill('123');
    await stripeFrame.locator('[name="billingPostalCode"]').fill('12345');

    await page.click('button:has-text("Pay")');

    // 5. Verify redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });

    // 6. Verify no activation prompt shown
    await expect(page.locator('[data-testid="activation-required"]')).not.toBeVisible();
  });

  test('C-ACT-02: Declined card shows error', async ({ page }) => {
    await page.goto('/onboarding');
    await page.click('button:has-text("Pay Activation Fee")');

    const stripeFrame = page.frameLocator('iframe[name*="stripe"]');
    await stripeFrame.locator('[name="cardNumber"]').fill('4000000000009995');
    await stripeFrame.locator('[name="cardExpiry"]').fill('1234');
    await stripeFrame.locator('[name="cardCvc"]').fill('123');

    await page.click('button:has-text("Pay")');

    // Should show error
    await expect(page.locator('[data-testid="payment-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-error"]')).toContainText(/insufficient|declined/i);
  });
});
```

### 4.3 E2E Test: Creator Subscription Flow

```typescript
// tests/e2e/payments/creator-subscription.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Creator Subscription', () => {
  test.beforeEach(async ({ page }) => {
    // Login as activated creator on Starter plan
    await page.goto('/login');
    await page.fill('[name="email"]', 'test-creator@example.com');
    await page.fill('[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
  });

  test('C-SUB-01: Upgrade from Starter to Pro', async ({ page }) => {
    // 1. Navigate to billing settings
    await page.goto('/settings/billing');

    // 2. Verify on Starter plan
    await expect(page.locator('[data-testid="current-plan"]')).toContainText('Starter');

    // 3. Click upgrade to Pro
    await page.click('button:has-text("Upgrade to Pro")');

    // 4. Complete Stripe checkout
    // ... (similar to activation test)

    // 5. Verify upgrade
    await expect(page.locator('[data-testid="current-plan"]')).toContainText('Pro');
    await expect(page.locator('[data-testid="monthly-fee"]')).toContainText('€30');
  });

  test('C-SUB-05: Cancel subscription', async ({ page }) => {
    // Assume already on Pro plan
    await page.goto('/settings/billing');

    await page.click('button:has-text("Manage Subscription")');
    // Opens Stripe billing portal

    // In portal, click cancel
    // ... portal interactions

    // Verify cancellation scheduled
    await expect(page.locator('[data-testid="subscription-status"]')).toContainText('Cancels');
  });
});
```

### 4.4 E2E Test: Student Course Purchase

```typescript
// tests/e2e/payments/student-course-purchase.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Student Course Purchase', () => {
  test.beforeEach(async ({ page }) => {
    // Login as student
    await page.goto('/login');
    await page.fill('[name="email"]', 'test-student@example.com');
    await page.fill('[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
  });

  test('S-CRS-01: Purchase paid course successfully', async ({ page }) => {
    // 1. Navigate to course
    await page.goto('/courses');
    await page.click('[data-testid="course-card"]:has-text("Premium Course")');

    // 2. Verify price shown
    await expect(page.locator('[data-testid="course-price"]')).toContainText('€50');

    // 3. Click enroll
    await page.click('button:has-text("Enroll")');

    // 4. Purchase modal appears
    await expect(page.locator('[data-testid="purchase-modal"]')).toBeVisible();

    // 5. Enter payment details
    const stripeFrame = page.frameLocator('iframe[name*="stripe"]');
    await stripeFrame.locator('[name="cardNumber"]').fill('4242424242424242');
    await stripeFrame.locator('[name="cardExpiry"]').fill('1234');
    await stripeFrame.locator('[name="cardCvc"]').fill('123');

    // 6. Confirm purchase
    await page.click('button:has-text("Pay €50")');

    // 7. Verify enrollment
    await expect(page.locator('[data-testid="enrollment-success"]')).toBeVisible();
    await expect(page.locator('button:has-text("Continue to Course")')).toBeVisible();
  });

  test('S-CRS-02: Enroll in free course', async ({ page }) => {
    await page.goto('/courses');
    await page.click('[data-testid="course-card"]:has-text("Free Course")');

    // Should show "Free" and direct enroll button
    await expect(page.locator('[data-testid="course-price"]')).toContainText('Free');

    await page.click('button:has-text("Enroll")');

    // No payment modal, direct enrollment
    await expect(page.locator('[data-testid="purchase-modal"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="enrollment-success"]')).toBeVisible();
  });
});
```

### 4.5 E2E Test: Student Plus Subscription

```typescript
// tests/e2e/payments/student-plus.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Student Plus Subscription', () => {
  test('S-PLUS-01: Subscribe to Student Plus', async ({ page }) => {
    // Login as student
    await page.goto('/login');
    await page.fill('[name="email"]', 'test-student@example.com');
    await page.fill('[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');

    // Navigate to Student Plus page
    await page.goto('/student-plus');

    // Verify pricing
    await expect(page.locator('[data-testid="plus-price"]')).toContainText('€9.90');

    // Click subscribe
    await page.click('button:has-text("Subscribe")');

    // Complete Stripe checkout (redirect flow)
    // Wait for redirect back with success
    await page.waitForURL(/\?success=true/, { timeout: 60000 });

    // Verify subscription active
    await expect(page.locator('[data-testid="plus-status"]')).toContainText('Active');
  });

  test('S-PLUS-02: Success redirect shows confirmation', async ({ page }) => {
    // Directly test the success state
    await page.goto('/student-plus?success=true');

    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Welcome to Student Plus');
  });
});
```

---

## Part 5: Manual Testing Checklist

### Pre-Test Setup
- [ ] Stripe CLI installed and logged in
- [ ] Test Stripe keys configured in Supabase
- [ ] Test user accounts created (creator + student)
- [ ] At least one course with price > €0 exists

### Creator Flow Checklist
- [ ] **C-ACT-01:** New creator can pay activation fee
- [ ] **C-ACT-02:** Declined card shows proper error
- [ ] **C-SUB-01:** Starter → Pro upgrade works
- [ ] **C-SUB-02:** Starter → Scale upgrade works
- [ ] **C-SUB-03:** Pro → Scale upgrade with proration
- [ ] **C-SUB-05:** Cancel subscription works
- [ ] **C-CON-01:** Connect onboarding starts
- [ ] **C-CON-02:** Connect onboarding completes
- [ ] **C-SALE-01:** First sale activates monthly fee

### Student Flow Checklist
- [ ] **S-CRS-01:** Purchase paid course works
- [ ] **S-CRS-02:** Free course enrollment works
- [ ] **S-PLUS-01:** Student Plus subscription works
- [ ] **S-PLUS-03:** Cancel Student Plus works

### Webhook Checklist
- [ ] `checkout.session.completed` processed
- [ ] `invoice.paid` updates subscription
- [ ] `customer.subscription.deleted` marks canceled
- [ ] `payment_intent.succeeded` creates enrollment
- [ ] Idempotency: duplicate events don't create duplicates

---

## Part 6: Test Data Cleanup

After testing, clean up test data:

```sql
-- Remove test subscriptions (careful!)
DELETE FROM student_plus_subscriptions WHERE user_id IN (
  SELECT id FROM auth.users WHERE email LIKE 'test-%@example.com'
);

DELETE FROM creator_billing WHERE creator_id IN (
  SELECT id FROM auth.users WHERE email LIKE 'test-%@example.com'
);

DELETE FROM creator_sales WHERE creator_id IN (
  SELECT id FROM auth.users WHERE email LIKE 'test-%@example.com'
);

-- Remove test webhook events
DELETE FROM webhook_events WHERE created_at > NOW() - INTERVAL '1 day';
```

---

## Summary

| Category | Test Count | Priority |
|----------|------------|----------|
| Creator Activation | 4 | P0 (Critical) |
| Creator Subscription | 6 | P0 (Critical) |
| Creator Connect | 4 | P1 (High) |
| Creator First Sale | 2 | P1 (High) |
| Student Course Purchase | 4 | P0 (Critical) |
| Student Plus | 5 | P1 (High) |
| Webhooks | 11 | P0 (Critical) |
| **Total** | **36** | |

**Estimated Manual Test Time:** 2-3 hours
**E2E Automation Coverage Target:** 80%+

---

## Part 7: Running E2E Tests

### Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create test environment file
cp .env.test.example .env.test
# Edit .env.test with real test credentials

# 3. Run auth setup
npm run test:setup

# 4. Run all payment tests (headed - see browser)
npm run test:headed

# Or run specific suites:
npm run test:creator  # Creator payment tests only
npm run test:student  # Student payment tests only
```

### Test Commands

| Command | Description |
|---------|-------------|
| `npm run test` | Run all tests headless |
| `npm run test:headed` | Run with visible browser |
| `npm run test:ui` | Open Playwright UI mode |
| `npm run test:creator` | Run creator tests only |
| `npm run test:student` | Run student tests only |
| `npm run test:report` | View HTML test report |

### Pre-Test Checklist

Before running tests:

- [ ] Stripe in TEST mode (sk_test_*, pk_test_*)
- [ ] Test user accounts created in Supabase
- [ ] `.env.test` configured with real credentials
- [ ] At least one paid course exists for testing

### Test Coverage

| Test File | Tests | Priority |
|-----------|-------|----------|
| `creator-activation.spec.ts` | 5 | P0 |
| `creator-subscription.spec.ts` | 6 | P0 |
| `creator-connect.spec.ts` | 4 | P1 |
| `student-course-purchase.spec.ts` | 5 | P0 |
| `student-plus.spec.ts` | 7 | P1 |
| **Total** | **27** | |
