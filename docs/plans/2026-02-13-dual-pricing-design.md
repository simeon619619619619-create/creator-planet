# Dual Pricing (One-time + Monthly) for Communities

**Date:** 2026-02-13
**Status:** Approved

## Problem

Creators can only set ONE pricing type per community (free, one_time, or monthly). They want to offer students a choice: pay once for lifetime access OR subscribe monthly.

## Design Decisions

- **Student UX**: Toggle on existing pricing card (not separate cards)
- **Creator UX**: Independent prices — creator sets one-time and monthly prices separately
- **DB approach**: Add `'both'` to pricing_type enum, new `monthly_price_cents` column
- **Checkout**: Frontend sends `checkoutMode` param, edge function picks correct price/mode

## Database Changes

**Migration adds to `communities` table:**
- `monthly_price_cents INTEGER DEFAULT 0` — monthly subscription price in cents
- `stripe_monthly_price_id TEXT` — Stripe price ID for recurring billing

**`pricing_type` constraint update:** Allow `'both'` as valid value.

**When `pricing_type = 'both'`:**
- `price_cents` = one-time price (existing column)
- `monthly_price_cents` = monthly price (new column)
- Both must be > 0

**No changes to `memberships` table** — already supports both payment types.

## Creator Settings UI

**`CommunityPricingSettings.tsx`:**
- Add 4th radio option: "One-time & Monthly"
- When selected, show TWO price input fields
- `updateCommunityPricing` sends both prices
- Stripe price IDs cleared when switching to `'both'` (lazy recreation)

## Checkout Flow (Edge Function)

**`community-checkout/index.ts`:**
- Accepts new param: `checkoutMode: 'one_time' | 'monthly'`
- Required when `pricing_type = 'both'`, ignored otherwise
- `one_time` → uses `price_cents` + `stripe_price_id`, `mode: 'payment'`
- `monthly` → uses `monthly_price_cents` + `stripe_monthly_price_id`, `mode: 'subscription'`
- Lazy Stripe price creation for whichever price ID is missing

**No webhook changes** — already handles both payment_intent and subscription.

## Landing Page Student UX

**Pricing card when `pricing_type = 'both'`:**
```
[ One-time €997 ]  [ Monthly €49/mo ]
```
- Default: one-time selected
- Toggle updates price display and buy button text
- Buy button passes `checkoutMode` to checkout service

**JoinButton:** Accepts optional `checkoutMode` prop, forwards to edge function.

**TBI button:** Hidden on monthly tab (BNPL only for one-time).

## Unchanged

- Free community flow
- Standalone one_time flow
- Standalone monthly flow
- Webhook handling
- Membership table schema
- Discount code system
