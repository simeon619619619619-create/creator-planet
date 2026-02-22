# Discount Codes System Design

**Date:** 2026-01-10
**Status:** Approved
**Author:** Claude (Brainstorming Session)

## Overview

Custom discount code system allowing creators to offer percentage-based discounts to students for communities and courses. Supports both targeted (student-specific) and shareable codes with configurable duration.

## Requirements

- Creators can create discount codes with percentage discounts (1-100%)
- Codes can be targeted to specific students or shareable
- Duration options: first month only, X months, or forever
- Codes can be scoped to specific communities/courses or all products
- Students enter codes on landing pages before checkout
- Discounts validated on our site, applied via Stripe at payment

## Database Schema

### `discount_codes` table

```sql
CREATE TABLE public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- The code itself
  code TEXT NOT NULL,

  -- Discount configuration
  discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  duration_months INTEGER, -- NULL = forever, 1 = first month only, 2+ = repeating

  -- Targeting (all NULL = anyone can use for any product)
  target_student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  target_community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  target_course_id UUID REFERENCES courses(id) ON DELETE CASCADE,

  -- Usage limits
  max_uses INTEGER, -- NULL = unlimited
  current_uses INTEGER DEFAULT 0,

  -- Validity period
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ, -- NULL = no expiry

  is_active BOOLEAN DEFAULT true,

  -- Stripe sync (created lazily on first use)
  stripe_coupon_id TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Codes unique per creator
  UNIQUE(creator_id, code)
);

-- Indexes
CREATE INDEX idx_discount_codes_creator ON discount_codes(creator_id);
CREATE INDEX idx_discount_codes_code ON discount_codes(code);
CREATE INDEX idx_discount_codes_target_student ON discount_codes(target_student_id) WHERE target_student_id IS NOT NULL;
```

### `discount_redemptions` table

```sql
CREATE TABLE public.discount_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- What was purchased
  community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,

  -- Financial details (all in cents)
  original_amount_cents INTEGER NOT NULL,
  discount_amount_cents INTEGER NOT NULL,
  final_amount_cents INTEGER NOT NULL,

  -- Stripe reference
  stripe_checkout_session_id TEXT,

  redeemed_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_discount_redemptions_code ON discount_redemptions(discount_code_id);
CREATE INDEX idx_discount_redemptions_student ON discount_redemptions(student_id);
```

### RLS Policies

```sql
-- Creators can manage their own codes
CREATE POLICY "Creators can manage own discount codes"
  ON discount_codes FOR ALL
  USING (creator_id = get_my_profile_id());

-- Students can view codes targeted to them (for validation)
CREATE POLICY "Students can view codes targeted to them"
  ON discount_codes FOR SELECT
  USING (target_student_id = get_my_profile_id() OR target_student_id IS NULL);

-- Service role for redemption tracking
CREATE POLICY "Service role manages redemptions"
  ON discount_redemptions FOR ALL
  USING (true)
  WITH CHECK (true);
```

## Stripe Integration

### Lazy Coupon Creation

Coupons are created in Stripe only when first used, not when the code is created:

```typescript
async function getOrCreateStripeCoupon(
  discountCode: DiscountCode,
  stripe: Stripe
): Promise<string> {
  // Return existing if already created
  if (discountCode.stripe_coupon_id) {
    return discountCode.stripe_coupon_id;
  }

  // Determine duration type
  let duration: 'once' | 'repeating' | 'forever';
  let duration_in_months: number | undefined;

  if (discountCode.duration_months === null) {
    duration = 'forever';
  } else if (discountCode.duration_months === 1) {
    duration = 'once';
  } else {
    duration = 'repeating';
    duration_in_months = discountCode.duration_months;
  }

  // Create Stripe coupon
  const coupon = await stripe.coupons.create({
    percent_off: discountCode.discount_percent,
    duration,
    duration_in_months,
    metadata: {
      creator_club_code_id: discountCode.id,
      creator_id: discountCode.creator_id,
      code: discountCode.code
    }
  });

  // Store back in database
  await supabase
    .from('discount_codes')
    .update({ stripe_coupon_id: coupon.id })
    .eq('id', discountCode.id);

  return coupon.id;
}
```

### Checkout Session with Discount

```typescript
const session = await stripe.checkout.sessions.create({
  mode: pricingType === 'monthly' ? 'subscription' : 'payment',
  line_items: [{ price: stripePriceId, quantity: 1 }],
  discounts: stripeCouponId ? [{ coupon: stripeCouponId }] : undefined,
  metadata: {
    discount_code_id: discountCode?.id,
    original_amount_cents: community.price_cents,
    // ... other metadata
  },
  // ... rest of config
});
```

## API Design

### New Edge Function: `discount-validate`

**Endpoint:** `POST /functions/v1/discount-validate`

**Request:**
```typescript
interface DiscountValidateRequest {
  code: string;
  communityId?: string;
  courseId?: string;
}
```

**Response:**
```typescript
interface DiscountValidateResponse {
  valid: boolean;
  discountPercent?: number;
  durationMonths?: number | null;
  durationLabel?: string; // "First month", "2 months", "Forever"
  originalPriceCents?: number;
  discountAmountCents?: number;
  finalPriceCents?: number;
  error?: string;
}
```

**Validation checks (in order):**
1. Code exists
2. Code is active
3. Code hasn't expired (valid_until)
4. Code is within valid period (valid_from)
5. Code hasn't exceeded max_uses
6. If targeted to student: current user matches
7. If targeted to community/course: requested product matches
8. User hasn't already redeemed this code (for single-use codes)

### Modified: `community-checkout`

Add optional `discountCode` to request:

```typescript
interface CommunityCheckoutRequest {
  communityId: string;
  successUrl: string;
  cancelUrl: string;
  discountCode?: string; // NEW
}
```

### Modified: `stripe-webhook`

On `checkout.session.completed`:
1. Extract `discount_code_id` from metadata
2. Insert redemption record
3. Increment `current_uses`

```typescript
if (session.metadata?.discount_code_id) {
  const discountCodeId = session.metadata.discount_code_id;

  // Record redemption
  await supabase.from('discount_redemptions').insert({
    discount_code_id: discountCodeId,
    student_id: profileId,
    community_id: session.metadata.community_id,
    original_amount_cents: parseInt(session.metadata.original_amount_cents),
    discount_amount_cents: session.total_details?.amount_discount || 0,
    final_amount_cents: session.amount_total,
    stripe_checkout_session_id: session.id
  });

  // Increment usage
  await supabase.rpc('increment_discount_usage', { code_id: discountCodeId });
}
```

## UI Components

### Creator: Discounts Page

**Route:** `/dashboard/discounts`

**Components:**
- `DiscountsPage.tsx` - Main page with list and filters
- `DiscountCodeCard.tsx` - Individual code display
- `CreateDiscountModal.tsx` - Create/edit form

**Create Form Fields:**
| Field | Type | Required | Default |
|-------|------|----------|---------|
| Code | text (auto-generate option) | Yes | - |
| Discount % | number (1-100) | Yes | - |
| Duration | select | Yes | "First month" |
| Target Product | select | No | "All products" |
| Target Student | email lookup | No | - |
| Max Uses | number | No | Unlimited |
| Expiry Date | date | No | No expiry |

### Student: Landing Page

**Modified files:**
- `CommunityLandingPage.tsx` - Add discount input section
- `JoinButton.tsx` - Accept and pass discount code

**Discount Input Component:**
```tsx
<DiscountCodeInput
  communityId={community.id}
  originalPriceCents={community.price_cents}
  onValidCode={(discount) => setAppliedDiscount(discount)}
  onClear={() => setAppliedDiscount(null)}
/>
```

**States:**
- Empty: Shows collapsed "Have a discount code?" link
- Expanded: Shows input + Apply button
- Validating: Shows spinner
- Valid: Shows success message with discounted price
- Invalid: Shows error message

## File Structure

```
src/features/discounts/
├── DiscountsPage.tsx
├── discountService.ts
├── discountTypes.ts
├── components/
│   ├── DiscountCodeCard.tsx
│   ├── CreateDiscountModal.tsx
│   └── DiscountCodeInput.tsx (for students)

supabase/functions/
├── discount-validate/
│   └── index.ts
├── community-checkout/
│   └── index.ts (modified)
└── stripe-webhook/
    └── index.ts (modified)

supabase/migrations/
└── 016_discount_codes.sql
```

## Implementation Phases

### Phase 1: Database & Types
- [ ] Create migration `016_discount_codes.sql`
- [ ] Add TypeScript types in `discountTypes.ts`
- [ ] Add RLS policies

### Phase 2: Validation Edge Function
- [ ] Create `discount-validate` edge function
- [ ] Implement all validation checks
- [ ] Deploy and test

### Phase 3: Checkout Integration
- [ ] Modify `community-checkout` to accept discount code
- [ ] Implement lazy Stripe coupon creation
- [ ] Update `stripe-webhook` to record redemptions
- [ ] Deploy and test end-to-end

### Phase 4: Creator UI
- [ ] Create `DiscountsPage.tsx`
- [ ] Create `DiscountCodeCard.tsx`
- [ ] Create `CreateDiscountModal.tsx`
- [ ] Add to sidebar navigation
- [ ] Implement CRUD operations

### Phase 5: Student UI
- [ ] Create `DiscountCodeInput.tsx` component
- [ ] Integrate into `CommunityLandingPage.tsx`
- [ ] Update `JoinButton.tsx` to pass discount
- [ ] Test full flow

## Security Considerations

1. **Server-side validation** - All discount logic runs server-side, client only displays
2. **RLS policies** - Creators only see their codes, students only see targeted codes
3. **Usage tracking** - Atomic increment to prevent race conditions
4. **Stripe as source of truth** - Final discount applied by Stripe, not our calculation
5. **Audit trail** - All redemptions logged with amounts

## Out of Scope

- Course purchases (no payment flow exists yet)
- Fixed amount discounts (percentage only for simplicity)
- Bulk code generation
- Discount analytics dashboard
- Referral codes (different system)
