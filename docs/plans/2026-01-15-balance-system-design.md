# Creator Balance & Payout System Design

**Date**: 2026-01-15
**Author**: Architect Agent
**Status**: Design Complete - Ready for Implementation

## Overview

This document describes the database schema and system design for the Creator Balance & Payout System. The system implements a wallet-style model where:

1. All student payments go to KINGDOM LTD (platform)
2. Creator balances are tracked in the database
3. Payouts are processed on a schedule via Stripe Connect

## Requirements Summary

From `docs/payment_plans_14thJan.md`:

| Requirement | Value |
|-------------|-------|
| Pending Period | 7 days before funds become available |
| Payout Schedule | Weekly (Fridays) |
| Minimum Payout | EUR 50 |
| Manual Withdrawal | 72-hour cooldown between withdrawals |
| Rolling Reserve (new creators) | 10% held for 120 days |
| Rolling Reserve (trusted creators) | 0-5% |
| Chargeback Handling | Deduct from balance, allow negative balance |

## Schema Overview

```
                    +-----------------------+
                    |   creator_billing     |
                    +-----------------------+
                    | + pending_balance     |
                    | + available_balance   |
                    | + reserved_balance    |
                    | + negative_balance    |
                    | + trust_level         |
                    | + reserve_percent     |
                    | + last_withdrawal_at  |
                    +-----------+-----------+
                                |
            +-------------------+-------------------+
            |                   |                   |
            v                   v                   v
+-------------------+  +-------------------+  +-------------------+
|  pending_balances |  |balance_transactions|  |     payouts       |
+-------------------+  +-------------------+  +-------------------+
| - Tracks 7-day    |  | - Audit trail of  |  | - Payout history  |
|   maturation      |  |   all balance     |  | - Transfer status |
| - Per-sale entry  |  |   changes         |  | - Auto/Manual     |
+-------------------+  +-------------------+  +-------------------+
```

## Table Definitions

### 1. creator_billing (Extended)

Add new columns to track creator wallet balances:

```sql
-- New columns to add
pending_balance_cents    INTEGER DEFAULT 0    -- Funds in 7-day hold
available_balance_cents  INTEGER DEFAULT 0    -- Ready for payout
reserved_balance_cents   INTEGER DEFAULT 0    -- Rolling reserve (120 days)
negative_balance_cents   INTEGER DEFAULT 0    -- Chargeback debt
reserve_percent          DECIMAL(5,2) DEFAULT 10.0  -- Current reserve %
trust_level              TEXT DEFAULT 'new'   -- 'new' or 'trusted'
last_withdrawal_at       TIMESTAMPTZ          -- For 72h cooldown
```

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| pending_balance_cents | INTEGER | 0 | Total funds in 7-day pending period |
| available_balance_cents | INTEGER | 0 | Funds ready for withdrawal/payout |
| reserved_balance_cents | INTEGER | 0 | Rolling reserve held for chargebacks |
| negative_balance_cents | INTEGER | 0 | Debt from chargebacks (must be paid before withdrawals) |
| reserve_percent | DECIMAL(5,2) | 10.0 | Current rolling reserve percentage |
| trust_level | TEXT | 'new' | Creator trust level ('new', 'trusted') |
| last_withdrawal_at | TIMESTAMPTZ | NULL | Timestamp of last manual withdrawal |

### 2. pending_balances (New Table)

Tracks each sale during its 7-day pending period:

```sql
CREATE TABLE pending_balances (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sale_id               UUID REFERENCES creator_sales(id),

  -- Amounts breakdown
  gross_amount_cents    INTEGER NOT NULL,      -- Total payment received
  platform_fee_cents    INTEGER NOT NULL,      -- Our platform fee
  stripe_fee_cents      INTEGER NOT NULL DEFAULT 0,  -- Stripe processing fee
  reserve_amount_cents  INTEGER NOT NULL,      -- Rolling reserve portion
  net_amount_cents      INTEGER NOT NULL,      -- What becomes available

  -- Timing
  available_at          TIMESTAMPTZ NOT NULL,  -- When funds become available (created_at + 7 days)

  -- Status
  status                TEXT DEFAULT 'pending' NOT NULL,
  -- 'pending'  = Waiting for 7-day period
  -- 'released' = Moved to available_balance
  -- 'cancelled' = Sale refunded/disputed before release

  -- Stripe references
  stripe_payment_id     TEXT,                  -- Payment intent or charge ID
  stripe_checkout_session_id TEXT,

  -- Metadata
  product_type          TEXT,                  -- 'membership', 'course', 'product'
  product_name          TEXT,

  created_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  released_at           TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ
);
```

| Column | Type | Description |
|--------|------|-------------|
| gross_amount_cents | INTEGER | Full payment amount before any deductions |
| platform_fee_cents | INTEGER | Platform fee (based on creator's plan %) |
| stripe_fee_cents | INTEGER | Stripe processing fee (~2.9% + 0.30) |
| reserve_amount_cents | INTEGER | Amount held as rolling reserve |
| net_amount_cents | INTEGER | `gross - platform_fee - stripe_fee - reserve` |
| available_at | TIMESTAMPTZ | `created_at + 7 days` |
| status | TEXT | pending / released / cancelled |

**Indexes:**
- `(creator_id, status)` - For querying pending balances per creator
- `(available_at, status)` - For cron job to release pending funds
- `(sale_id)` - For linking to creator_sales

### 3. balance_transactions (New Table)

Immutable audit trail of all balance changes:

```sql
CREATE TABLE balance_transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Transaction details
  type                  TEXT NOT NULL,
  -- Types: 'sale_pending', 'pending_released', 'platform_fee_deducted',
  --        'reserve_hold', 'reserve_release', 'payout', 'withdrawal',
  --        'chargeback', 'chargeback_reversal', 'adjustment'

  amount_cents          INTEGER NOT NULL,      -- Positive = credit, Negative = debit

  -- Balance snapshots after this transaction
  pending_after_cents   INTEGER NOT NULL,
  available_after_cents INTEGER NOT NULL,
  reserved_after_cents  INTEGER NOT NULL,
  negative_after_cents  INTEGER NOT NULL,

  -- References
  reference_type        TEXT,                  -- 'pending_balance', 'payout', 'dispute', 'sale'
  reference_id          TEXT,                  -- ID of related record
  stripe_id             TEXT,                  -- Stripe transfer/refund/dispute ID

  description           TEXT,
  metadata              JSONB DEFAULT '{}',

  created_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

| Column | Type | Description |
|--------|------|-------------|
| type | TEXT | Transaction type (see list below) |
| amount_cents | INTEGER | Positive for credits, negative for debits |
| *_after_cents | INTEGER | Balance snapshot after transaction |
| reference_type | TEXT | Type of related record |
| reference_id | TEXT | ID of related record |
| stripe_id | TEXT | Stripe ID for transfers/disputes |

**Transaction Types:**
- `sale_pending` - New sale added to pending balance
- `pending_released` - Pending funds moved to available (after 7 days)
- `platform_fee_deducted` - Platform fee recorded
- `reserve_hold` - Funds moved to rolling reserve
- `reserve_release` - Reserve released after 120 days
- `payout` - Automatic weekly payout
- `withdrawal` - Manual withdrawal by creator
- `chargeback` - Dispute deducted from balance
- `chargeback_reversal` - Won dispute credited back
- `adjustment` - Manual admin adjustment

**Indexes:**
- `(creator_id, created_at DESC)` - Transaction history
- `(type, created_at)` - For analytics
- `(reference_type, reference_id)` - For lookups

### 4. payouts (New Table)

History of all payouts to creators:

```sql
CREATE TABLE payouts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Payout details
  amount_cents          INTEGER NOT NULL,
  currency              TEXT DEFAULT 'EUR' NOT NULL,

  -- Type
  type                  TEXT DEFAULT 'automatic' NOT NULL,
  -- 'automatic' = Weekly Friday payout
  -- 'manual'    = Creator-requested withdrawal

  -- Status flow: pending -> processing -> completed/failed
  status                TEXT DEFAULT 'pending' NOT NULL,
  -- 'pending'    = Queued for processing
  -- 'processing' = Transfer initiated with Stripe
  -- 'completed'  = Successfully sent to creator
  -- 'failed'     = Transfer failed

  -- Stripe references
  stripe_transfer_id    TEXT,                  -- Transfer to Connect account
  stripe_payout_id      TEXT,                  -- Payout from Connect to bank

  -- Error handling
  failure_code          TEXT,
  failure_message       TEXT,
  retry_count           INTEGER DEFAULT 0,

  -- Timestamps
  created_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  processing_at         TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  failed_at             TIMESTAMPTZ
);
```

| Column | Type | Description |
|--------|------|-------------|
| type | TEXT | 'automatic' (weekly) or 'manual' (withdrawal) |
| status | TEXT | pending / processing / completed / failed |
| stripe_transfer_id | TEXT | Stripe Transfer object ID |
| stripe_payout_id | TEXT | Stripe Payout object ID (optional) |
| failure_code | TEXT | Stripe error code if failed |
| retry_count | INTEGER | Number of retry attempts |

**Indexes:**
- `(creator_id, created_at DESC)` - Payout history
- `(status, created_at)` - For processing queue
- `(stripe_transfer_id)` - For webhook lookups

### 5. reserve_releases (New Table)

Tracks rolling reserve entries for 120-day release:

```sql
CREATE TABLE reserve_releases (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pending_balance_id    UUID REFERENCES pending_balances(id),

  amount_cents          INTEGER NOT NULL,      -- Reserve amount
  release_at            TIMESTAMPTZ NOT NULL,  -- created_at + 120 days

  status                TEXT DEFAULT 'held' NOT NULL,
  -- 'held'     = Reserve still active
  -- 'released' = Moved to available_balance
  -- 'used'     = Consumed by chargeback

  created_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  released_at           TIMESTAMPTZ,
  used_at               TIMESTAMPTZ,
  used_for_dispute_id   TEXT                   -- Stripe dispute ID if used
);
```

**Indexes:**
- `(creator_id, status)` - Active reserves per creator
- `(release_at, status)` - For cron job to release reserves

## Balance Flow Diagrams

### Flow 1: New Sale (Student Payment)

```
Student pays EUR 100 for membership
         |
         v
+-------------------+
| Calculate amounts |
| - Platform fee: 6.9% = EUR 6.90
| - Reserve: 10% = EUR 10.00
| - Net: EUR 83.10 (after 7 days)
+-------------------+
         |
         v
+-------------------+
| Create pending_balance record
| available_at = NOW() + 7 days
+-------------------+
         |
         v
+-------------------+
| Update creator_billing
| pending_balance += EUR 83.10
+-------------------+
         |
         v
+-------------------+
| Create balance_transaction
| type = 'sale_pending'
+-------------------+
```

### Flow 2: Pending Release (After 7 Days)

```
Cron job runs daily
         |
         v
+-------------------+
| Query pending_balances
| WHERE available_at <= NOW()
| AND status = 'pending'
+-------------------+
         |
         v (for each record)
+-------------------+
| Update pending_balance
| status = 'released'
+-------------------+
         |
         v
+-------------------+
| Update creator_billing
| pending_balance -= amount
| available_balance += amount
+-------------------+
         |
         v
+-------------------+
| Create reserve_release
| release_at = NOW() + 120 days
+-------------------+
         |
         v
+-------------------+
| Create balance_transaction
| type = 'pending_released'
+-------------------+
```

### Flow 3: Weekly Payout (Friday)

```
Cron job runs every Friday
         |
         v
+-------------------+
| Query creator_billing
| WHERE available_balance >= 5000 (EUR 50)
| AND stripe_account_status = 'active'
| AND negative_balance = 0
+-------------------+
         |
         v (for each creator)
+-------------------+
| Create payout record
| status = 'pending'
+-------------------+
         |
         v
+-------------------+
| Call Stripe Transfer API
| destination = stripe_account_id
+-------------------+
         |
         v
+-------------------+
| On success:
| - payout.status = 'completed'
| - available_balance = 0
| - Create balance_transaction
+-------------------+
```

### Flow 4: Manual Withdrawal

```
Creator clicks "Withdraw"
         |
         v
+-------------------+
| Validate:
| - available_balance >= EUR 50
| - last_withdrawal_at + 72h < NOW()
| - negative_balance = 0
| - stripe_account_status = 'active'
+-------------------+
         |
         v
+-------------------+
| Create payout record
| type = 'manual'
+-------------------+
         |
         v
(same as weekly payout flow)
```

### Flow 5: Chargeback

```
Stripe webhook: charge.dispute.created
         |
         v
+-------------------+
| Find creator from charge
+-------------------+
         |
         v
+-------------------+
| Deduct from available_balance
| If available < dispute_amount:
|   - Use all available
|   - negative_balance += remainder
+-------------------+
         |
         v
+-------------------+
| Create balance_transaction
| type = 'chargeback'
+-------------------+
         |
         v
+-------------------+
| Mark any matching reserve
| as 'used' if needed
+-------------------+
```

### Flow 6: Chargeback Won

```
Stripe webhook: charge.dispute.closed
status = 'won'
         |
         v
+-------------------+
| Find original chargeback
| transaction
+-------------------+
         |
         v
+-------------------+
| Credit back to available_balance
| (or reduce negative_balance)
+-------------------+
         |
         v
+-------------------+
| Create balance_transaction
| type = 'chargeback_reversal'
+-------------------+
```

## RLS Policies

### pending_balances

```sql
-- Creators can view their own pending balances
CREATE POLICY "Creators can view own pending balances"
  ON pending_balances FOR SELECT
  USING (creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Service role only for modifications
CREATE POLICY "Service role manages pending balances"
  ON pending_balances FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
```

### balance_transactions

```sql
-- Creators can view their own transactions
CREATE POLICY "Creators can view own balance transactions"
  ON balance_transactions FOR SELECT
  USING (creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Service role only for inserts (immutable - no updates allowed)
CREATE POLICY "Service role manages balance transactions"
  ON balance_transactions FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
```

### payouts

```sql
-- Creators can view their own payouts
CREATE POLICY "Creators can view own payouts"
  ON payouts FOR SELECT
  USING (creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Service role only for modifications
CREATE POLICY "Service role manages payouts"
  ON payouts FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
```

### reserve_releases

```sql
-- Creators can view their own reserves
CREATE POLICY "Creators can view own reserves"
  ON reserve_releases FOR SELECT
  USING (creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Service role only for modifications
CREATE POLICY "Service role manages reserves"
  ON reserve_releases FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
```

## Edge Cases

### 1. Partial Balance for Chargeback

When `available_balance < chargeback_amount`:
- Deduct all available balance
- Remaining amount goes to `negative_balance`
- Creator cannot receive payouts until negative balance is cleared

### 2. Chargeback During Pending Period

If a sale is disputed before the 7-day pending period ends:
- Mark `pending_balance` record as `cancelled`
- Deduct from `pending_balance_cents` in `creator_billing`
- No negative balance needed (funds never released)

### 3. Reserve Used for Chargeback

When chargeback amount exceeds available balance:
- First deduct from `available_balance`
- Then use `reserved_balance` (mark reserve_release as 'used')
- Finally, remaining goes to `negative_balance`

### 4. Trust Level Upgrade

Criteria for 'new' -> 'trusted' upgrade:
- No chargebacks in last 90 days
- At least EUR 1,000 in completed payouts
- Account age > 180 days
- Verified Stripe Connect account

When upgraded:
- Set `reserve_percent` to 0-5% (configurable)
- Existing reserves continue on 120-day schedule

### 5. Connect Account Not Active

If creator hasn't set up Stripe Connect:
- Balances still accumulate
- Payouts are blocked
- UI shows "Set up payouts to receive funds"

### 6. Failed Payout Retry

On payout failure:
- Keep funds in `available_balance`
- Increment `retry_count`
- Log failure reason
- Retry on next payout cycle (max 3 retries)
- After 3 failures, require manual intervention

## Database Functions

### calculate_creator_payout_amount

```sql
CREATE FUNCTION calculate_creator_payout_amount(p_creator_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_available INTEGER;
  v_negative INTEGER;
BEGIN
  SELECT available_balance_cents, negative_balance_cents
  INTO v_available, v_negative
  FROM creator_billing
  WHERE creator_id = p_creator_id;

  -- Negative balance must be cleared first
  IF v_negative > 0 THEN
    RETURN GREATEST(0, v_available - v_negative);
  END IF;

  RETURN v_available;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### can_creator_withdraw

```sql
CREATE FUNCTION can_creator_withdraw(p_creator_id UUID)
RETURNS JSON AS $$
DECLARE
  v_billing creator_billing%ROWTYPE;
  v_payout_amount INTEGER;
BEGIN
  SELECT * INTO v_billing
  FROM creator_billing
  WHERE creator_id = p_creator_id;

  -- Check Connect status
  IF v_billing.stripe_account_status != 'active' THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'CONNECT_NOT_ACTIVE',
      'message', 'Please complete Stripe Connect setup'
    );
  END IF;

  -- Check cooldown
  IF v_billing.last_withdrawal_at IS NOT NULL
     AND v_billing.last_withdrawal_at + INTERVAL '72 hours' > NOW() THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'COOLDOWN_ACTIVE',
      'message', 'Please wait 72 hours between withdrawals',
      'available_at', v_billing.last_withdrawal_at + INTERVAL '72 hours'
    );
  END IF;

  -- Calculate payout amount
  v_payout_amount := calculate_creator_payout_amount(p_creator_id);

  -- Check minimum
  IF v_payout_amount < 5000 THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'BELOW_MINIMUM',
      'message', 'Minimum withdrawal is EUR 50',
      'current_amount', v_payout_amount,
      'minimum', 5000
    );
  END IF;

  RETURN json_build_object(
    'allowed', true,
    'amount_cents', v_payout_amount,
    'message', 'Withdrawal available'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Migration File

The complete migration is in:
`supabase/migrations/026_balance_system.sql`

## Implementation Notes

### For Implementers

1. **Webhook Handler Updates** (Implementer-1):
   - Remove instant split payments
   - Credit `pending_balances` on `checkout.session.completed`
   - Handle `charge.dispute.created` and `charge.dispute.closed`

2. **Cron Jobs Needed** (Implementer-3):
   - Daily: Release pending balances (7-day check)
   - Daily: Release reserves (120-day check)
   - Weekly (Friday): Process automatic payouts

3. **UI Components** (Implementer-2):
   - BalanceCard: Show pending/available/reserved/negative
   - WithdrawalModal: Manual withdrawal with validation
   - PayoutHistory: List of past payouts

### Critical Warnings

1. **Use profiles.id for creator_id** - NOT auth.users.id (see CLAUDE.md gotchas)
2. **All amounts in integer cents** - EUR 30 = 3000 cents
3. **Service role for all balance modifications** - RLS blocks direct client updates
4. **Idempotency** - Check for existing records before processing webhooks
