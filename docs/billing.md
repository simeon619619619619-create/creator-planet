# Billing System

## Architecture
Hybrid pricing model:
- **Fixed monthly fee** (starts after first sale for Pro/Scale)
- **Percentage-based platform fee** on all sales
- **One-time activation fee** (€9.90) on registration (exclusive plan exempt)

## Creator Plans
| Plan | Monthly Fee | Platform Fee | Features |
|------|-------------|--------------|----------|
| Starter | €0 | 6.9% | 50 students, 2 courses, 1 community |
| Pro | €30 | 3.9% | 500 students, 10 courses, 3 communities |
| Scale | €99 | 1.9% | Unlimited, white-label, API access |

## Stripe Products (New Account — TBD)
- Activation Fee (€9.90 one-time)
- Pro Plan (€30/month)
- Scale Plan (€99/month)
- Student Plus (€9.90/month)

## Webhook Configuration
- **Endpoint**: `https://ilntxxutxbygjuixrzng.supabase.co/functions/v1/stripe-webhook`
- **Events**: checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.*, account.updated, charge.dispute.*

## Database Tables
- `billing_plans` - Plan configurations
- `creator_billing` - Creator billing state (balance columns)
- `billing_transactions` - Transaction ledger
- `creator_sales` - Sales with platform fees
- `webhook_events` - Idempotent webhook log
- `pending_balances` - Funds in 7-day hold
- `balance_transactions` - Balance ledger
- `payouts` - Payout history with Stripe transfer IDs
- `reserve_releases` - Rolling 120-day reserve releases

## Balance System (Wallet Model)
Platform collects 100% of payments, tracks creator balances in DB, processes weekly payouts via Connect.

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

**Withdrawal Rules**: Minimum €50, 72-hour cooldown, Connect account must be active

## Billing Settings Page
- **Balance Card** — `creator_billing` columns
- **Revenue Overview** — aggregates from `creator_sales`
- **Community Sales** — individual `creator_sales` records
- **Withdrawal History** — `payouts` records
