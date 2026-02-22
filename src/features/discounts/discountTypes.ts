/**
 * Discount Codes System Types
 *
 * Allows creators to create custom discount codes for students
 * with percentage-based discounts and configurable duration.
 */

// ============================================================================
// Database Types
// ============================================================================

export interface DiscountCode {
  id: string;
  creator_id: string;
  code: string;
  discount_percent: number;
  duration_months: number | null; // null = forever, 1 = first month, 2+ = repeating
  target_student_id: string | null;
  target_community_id: string | null;
  target_course_id: string | null;
  max_uses: number | null; // null = unlimited
  current_uses: number;
  valid_from: string;
  valid_until: string | null; // null = no expiry
  is_active: boolean;
  stripe_coupon_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscountRedemption {
  id: string;
  discount_code_id: string;
  student_id: string;
  community_id: string | null;
  course_id: string | null;
  original_amount_cents: number;
  discount_amount_cents: number;
  final_amount_cents: number;
  stripe_checkout_session_id: string | null;
  redeemed_at: string;
}

// ============================================================================
// Extended Types (with joined data)
// ============================================================================

export interface DiscountCodeWithDetails extends DiscountCode {
  target_student?: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
  target_community?: {
    id: string;
    name: string;
  } | null;
  target_course?: {
    id: string;
    title: string;
  } | null;
  redemptions_count?: number;
}

export interface DiscountRedemptionWithDetails extends DiscountRedemption {
  discount_code?: DiscountCode;
  student?: {
    id: string;
    full_name: string | null;
    email: string | null;
  };
  community?: {
    id: string;
    name: string;
  } | null;
  course?: {
    id: string;
    title: string;
  } | null;
}

// ============================================================================
// Form/Input Types
// ============================================================================

export interface CreateDiscountCodeInput {
  code: string;
  discount_percent: number;
  duration_months: number | null;
  target_student_email?: string; // Will be resolved to ID
  target_community_id?: string;
  target_course_id?: string;
  max_uses?: number;
  valid_until?: string;
}

export interface UpdateDiscountCodeInput {
  code?: string;
  discount_percent?: number;
  duration_months?: number | null;
  target_student_id?: string | null;
  target_community_id?: string | null;
  target_course_id?: string | null;
  max_uses?: number | null;
  valid_until?: string | null;
  is_active?: boolean;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface DiscountValidationRequest {
  code: string;
  communityId?: string;
  courseId?: string;
}

export interface DiscountValidationResponse {
  valid: boolean;
  discountPercent?: number;
  durationMonths?: number | null;
  durationLabel?: string; // "First month", "2 months", "Forever"
  originalPriceCents?: number;
  discountAmountCents?: number;
  finalPriceCents?: number;
  codeId?: string; // For passing to checkout
  error?: string;
}

export type DiscountValidationError =
  | 'CODE_NOT_FOUND'
  | 'CODE_INACTIVE'
  | 'CODE_EXPIRED'
  | 'CODE_NOT_YET_VALID'
  | 'CODE_MAX_USES_REACHED'
  | 'CODE_NOT_FOR_YOU'
  | 'CODE_WRONG_PRODUCT'
  | 'CODE_ALREADY_USED'
  | 'PRODUCT_NOT_FOUND'
  | 'VALIDATION_ERROR';

export const DISCOUNT_ERROR_MESSAGES: Record<DiscountValidationError, string> = {
  CODE_NOT_FOUND: "This discount code doesn't exist",
  CODE_INACTIVE: 'This discount code is no longer active',
  CODE_EXPIRED: 'This discount code has expired',
  CODE_NOT_YET_VALID: 'This discount code is not yet valid',
  CODE_MAX_USES_REACHED: 'This discount code has reached its usage limit',
  CODE_NOT_FOR_YOU: 'This discount code is not valid for your account',
  CODE_WRONG_PRODUCT: "This discount code isn't valid for this product",
  CODE_ALREADY_USED: "You've already used this discount code",
  PRODUCT_NOT_FOUND: 'Product not found',
  VALIDATION_ERROR: 'Unable to validate discount code',
};

// ============================================================================
// UI Helper Types
// ============================================================================

export type DurationOption =
  | { type: 'once'; label: 'First month only' }
  | { type: 'repeating'; months: number; label: string }
  | { type: 'forever'; label: 'Forever' };

export const DURATION_OPTIONS: DurationOption[] = [
  { type: 'once', label: 'First month only' },
  { type: 'repeating', months: 2, label: '2 months' },
  { type: 'repeating', months: 3, label: '3 months' },
  { type: 'repeating', months: 6, label: '6 months' },
  { type: 'repeating', months: 12, label: '12 months' },
  { type: 'forever', label: 'Forever' },
];

/**
 * Get human-readable duration label
 */
export function getDurationLabel(durationMonths: number | null): string {
  if (durationMonths === null) return 'Forever';
  if (durationMonths === 1) return 'First month only';
  return `${durationMonths} months`;
}

/**
 * Convert duration option to database value
 */
export function durationOptionToMonths(option: DurationOption): number | null {
  if (option.type === 'forever') return null;
  if (option.type === 'once') return 1;
  return option.months;
}

/**
 * Generate a random discount code
 */
export function generateDiscountCode(length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Format cents as currency
 */
export function formatCents(cents: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}
