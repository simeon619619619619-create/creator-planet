# Stripe Purchase Flows - Test Checklist

> **Account**: KINGDOM LTD (`acct_1SoV6VEHrm7Q2JIn`)
> **Mode**: Live (real payments)
> **Date**: 2026-01-11

---

## 1. Creator Activation Fee

**Flow**: New creator signup → Pay €2.90 activation fee → Account activated

**Steps to Test**:
1. Go to https://creator-club.vercel.app/signup
2. Fill in creator registration form
3. Select a plan (Starter, Pro, or Scale)
4. Complete Stripe Checkout for €2.90 activation fee
5. Verify redirect to onboarding success page
6. Check database: `creator_billing.is_activated = true`

**Edge Function**: `stripe-checkout`
**Price ID**: `price_1SoVqmEHrm7Q2JInDhOmJrIa`

**Expected Webhook Events**:
- `checkout.session.completed` (type: activation)

---

## 2. Creator Plan Subscription (Pro/Scale)

**Flow**: Creator with first sale → Monthly subscription starts

**Steps to Test**:
1. Login as activated creator with `has_first_sale = true`
2. Go to Billing Settings → Manage Plan
3. Select Pro (€30/mo) or Scale (€99/mo)
4. Complete Stripe Checkout
5. Verify subscription created in Stripe Dashboard
6. Check database: `creator_billing.stripe_subscription_id` populated

**Edge Function**: `stripe-subscription`
**Price IDs**:
- Pro: `price_1SoVqmEHrm7Q2JIncZnyu9SY`
- Scale: `price_1SoVqmEHrm7Q2JInneH7wG9d`

**Expected Webhook Events**:
- `checkout.session.completed` (type: plan_subscription)
- `customer.subscription.created`
- `invoice.paid`

---

## 3. Creator Plan Change (Upgrade/Downgrade)

### 3a. Upgrade (Starter → Pro, Pro → Scale)

**Flow**: Immediate upgrade with proration

**Steps to Test**:
1. Login as creator on lower plan
2. Go to Billing Settings → Change Plan
3. Select higher tier
4. Confirm upgrade in modal
5. Verify immediate plan change
6. Check prorated charge in Stripe

**Expected Behavior**:
- Immediate access to new plan features
- Prorated charge for remainder of billing period

### 3b. Downgrade (Scale → Pro, Pro → Starter)

**Flow**: Downgrade at period end

**Steps to Test**:
1. Login as creator on higher plan
2. Go to Billing Settings → Change Plan
3. Select lower tier
4. Confirm downgrade in modal
5. Verify `cancel_at_period_end` set
6. Plan changes at next billing cycle

**Expected Webhook Events**:
- `customer.subscription.updated`

---

## 4. Student Plus Subscription

**Flow**: Student subscribes to Student Plus (€9.90/mo)

**Steps to Test**:
1. Login as student (non-creator)
2. Navigate to Student Plus upgrade option
3. Complete Stripe Checkout for €9.90/mo
4. Verify subscription created
5. Check database: `student_subscriptions` record created

**Edge Function**: `student-plus-checkout`
**Price ID**: `price_1SoVqnEHrm7Q2JInAADYSo3z`

**Expected Webhook Events**:
- `checkout.session.completed` (type: student_plus)
- `customer.subscription.created`
- `invoice.paid`

---

## 5. Student Plus Portal (Manage Subscription)

**Flow**: Student manages their subscription via Stripe Portal

**Steps to Test**:
1. Login as Student Plus subscriber
2. Go to account settings
3. Click "Manage Subscription"
4. Verify redirect to Stripe Customer Portal
5. Test: Update payment method
6. Test: Cancel subscription
7. Verify return to app

**Edge Function**: `student-plus-portal`

---

## 6. Paid Community Purchase (One-Time)

**Flow**: Student purchases one-time access to paid community

**Steps to Test**:
1. Login as student
2. Browse to a paid community (one-time pricing)
3. Click "Join" / "Purchase Access"
4. Complete Stripe Checkout
5. Verify membership created with `payment_status = paid`
6. Verify platform fee deducted (creator receives net amount)

**Edge Function**: `community-checkout`

**Expected Webhook Events**:
- `checkout.session.completed` (type: community_purchase)

**Connect Verification**:
- Payment goes to platform
- Application fee deducted (based on creator's plan tier)
- Net amount transferred to creator's Connect account

---

## 7. Paid Community Subscription (Monthly)

**Flow**: Student subscribes to monthly community access

**Steps to Test**:
1. Login as student
2. Browse to a paid community (monthly pricing)
3. Click "Subscribe"
4. Complete Stripe Checkout
5. Verify recurring subscription created
6. Verify membership with `payment_status = paid`

**Edge Function**: `community-checkout`

**Expected Webhook Events**:
- `checkout.session.completed` (type: community_subscription)
- `customer.subscription.created`
- `invoice.paid`

---

## 8. Community Purchase with Discount Code

**Flow**: Student uses creator's discount code

**Steps to Test**:
1. Create discount code in creator dashboard
2. Login as student
3. Go to paid community checkout
4. Enter discount code
5. Verify discounted price shown
6. Complete checkout
7. Verify `discount_redemptions` record created

**Validations to Test**:
- Invalid code → Error message
- Expired code → Error message
- Already used code → Error message
- Wrong community → Error message

---

## 9. Creator Connect Onboarding

**Flow**: Creator sets up Stripe Connect for payouts

**Steps to Test**:
1. Login as activated creator
2. Go to Billing Settings → Payout Setup
3. Click "Set Up Payouts"
4. Verify Connect Express account created
5. Complete Stripe hosted onboarding
6. Verify `stripe_account_status = active`
7. Test Express Dashboard access

**Edge Function**: `stripe-connect`

**Expected Webhook Events**:
- `account.updated`

---

## 10. Creator Billing Portal

**Flow**: Creator manages payment method via Stripe Portal

**Steps to Test**:
1. Login as creator with active subscription
2. Go to Billing Settings
3. Click "Manage Payment Method"
4. Verify redirect to Stripe Customer Portal
5. Update card details
6. Return to app

**Edge Function**: `stripe-subscription` (action: billing-portal)

---

## Webhook Verification

After each flow, verify in Supabase:
```sql
SELECT * FROM webhook_events
ORDER BY created_at DESC
LIMIT 10;
```

Check for:
- ✅ Event received and processed
- ✅ No duplicate processing (idempotency)
- ✅ Correct status updates in related tables

---

## Test Data Reference

| Role | Test Account | Notes |
|------|--------------|-------|
| New Creator | Create fresh | Test activation flow |
| Activated Creator | Existing with `is_activated=true` | Test subscriptions |
| Creator with Sales | `has_first_sale=true` | Test plan billing |
| Student | Non-creator account | Test student flows |
| Student Plus | With active subscription | Test portal |

---

## Stripe Dashboard Checks

After testing, verify in Stripe Dashboard:
1. **Customers**: New customers created correctly
2. **Subscriptions**: Active subscriptions with correct prices
3. **Payments**: Successful payments logged
4. **Connect**: Creator accounts created and active
5. **Webhooks**: All events delivered successfully (no failures)

Dashboard URL: https://dashboard.stripe.com/acct_1SoV6VEHrm7Q2JIn
