// Community Monetization Types
// Types for paid communities with Stripe integration

import type { DbCommunity, DbMembership } from '../../core/supabase/database.types';

// ============================================================================
// PRICING TYPES
// ============================================================================

/**
 * How a community is priced
 * - free: No payment required to join
 * - one_time: Single payment for lifetime access
 * - monthly: Recurring monthly subscription
 * - both: Creator offers both one-time and monthly, student chooses at checkout
 */
export type CommunityPricingType = 'free' | 'one_time' | 'monthly' | 'both';

/**
 * Payment status for a membership
 * - none: Free community, no payment needed
 * - pending: Payment initiated but not completed
 * - paid: Payment successful, access granted
 * - failed: Payment failed
 * - canceled: Subscription canceled by user
 * - expired: Subscription expired (past due or ended)
 */
export type MembershipPaymentStatus = 'none' | 'pending' | 'paid' | 'failed' | 'canceled' | 'expired';

/**
 * Shorthand alias for MembershipPaymentStatus
 * Used in simpler contexts where full name is verbose
 */
export type PaymentStatus = MembershipPaymentStatus;

// ============================================================================
// COMMUNITY PRICING
// ============================================================================

/**
 * Pricing configuration for a community
 */
export interface CommunityPricing {
  pricing_type: CommunityPricingType;
  price_cents: number | null;        // null for free communities
  currency: string;                   // ISO 4217 currency code (e.g., 'EUR', 'USD')
  stripe_product_id: string | null;   // Stripe product ID for paid communities
  stripe_price_id: string | null;     // Stripe price ID for paid communities
  monthly_price_cents?: number | null;       // Monthly price when pricing_type is 'both'
  stripe_monthly_price_id?: string | null;   // Stripe Price ID for recurring billing when 'both'
}

/**
 * Community with pricing fields (extends base DbCommunity)
 */
export interface CommunityWithPricing extends DbCommunity {
  pricing_type: CommunityPricingType;
  price_cents: number | null;
  currency: string;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  monthly_price_cents?: number | null;
  stripe_monthly_price_id?: string | null;
}

// ============================================================================
// MEMBERSHIP PAYMENT
// ============================================================================

/**
 * Membership with payment tracking fields (extends base DbMembership)
 */
export interface MembershipWithPayment extends DbMembership {
  payment_status: MembershipPaymentStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;      // For monthly subscriptions
  stripe_payment_intent_id: string | null;    // For one-time payments
  paid_at: string | null;                     // ISO timestamp when payment completed
  expires_at: string | null;                  // For subscriptions: when access expires
  canceled_at: string | null;                 // When subscription was canceled
}

/**
 * Lightweight payment info subset (for components that don't need full membership)
 */
export interface MembershipPaymentInfo {
  payment_status: PaymentStatus;
  stripe_subscription_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  expires_at: string | null;
}

// ============================================================================
// PURCHASE TRACKING
// ============================================================================

/**
 * Community purchase record for tracking sales and analytics
 */
export interface CommunityPurchase {
  id: string;
  community_id: string;
  user_id: string;                            // profile.id of the buyer
  creator_id: string;                         // profile.id of the community owner
  pricing_type: CommunityPricingType;
  amount_cents: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  stripe_subscription_id: string | null;
  stripe_charge_id: string | null;
  platform_fee_cents: number;                 // Our platform fee
  stripe_fee_cents: number;                   // Stripe processing fee
  net_amount_cents: number;                   // Amount creator receives
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  refunded_at: string | null;
  created_at: string;
  completed_at: string | null;
}

// ============================================================================
// UI DISPLAY TYPES
// ============================================================================

/**
 * Formatted pricing info for UI display
 */
export interface CommunityPricingDisplay {
  type: CommunityPricingType;
  price: string;                              // Formatted price string (e.g., "€29.99", "Free")
  interval: string | null;                    // null for free/one-time, "month" for monthly
  buttonText: string;                         // CTA button text (e.g., "Join Free", "Subscribe", "Buy Access")
}

/**
 * Form data for community pricing settings
 * Note: price is in whole units (e.g., euros) for UI convenience,
 * converted to cents when saving to database
 */
export interface CommunityPricingFormData {
  pricing_type: CommunityPricingType;
  price: number;                              // In whole units (euros), converted to cents when saving
  currency: string;                           // ISO 4217 currency code (e.g., 'EUR', 'USD')
  monthlyPrice?: number;                      // Monthly price in whole units, used when pricing_type is 'both'
}

// ============================================================================
// CHECKOUT TYPES
// ============================================================================

/**
 * Request payload for community checkout
 */
export interface CommunityCheckoutRequest {
  communityId: string;
  successUrl: string;                         // Redirect URL after successful payment
  cancelUrl: string;                          // Redirect URL if user cancels
  discountCode?: string;                      // Optional discount code to apply
  checkoutMode?: 'one_time' | 'monthly';     // Required when pricing_type is 'both'
}

/**
 * Result from checkout session creation
 */
export interface CommunityCheckoutResult {
  success: boolean;
  checkoutUrl?: string;                       // Stripe Checkout URL to redirect user to
  sessionId?: string;                         // Stripe Checkout Session ID
  error?: string;                             // Error message if success is false
}

/**
 * Simplified checkout response (for direct API responses)
 * Alternative to CommunityCheckoutResult when success is guaranteed
 */
export interface CommunityCheckoutResponse {
  checkout_url: string;                       // Stripe Checkout URL to redirect user to
  session_id: string;                         // Stripe Checkout Session ID
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format price for display
 */
export function formatCommunityPrice(
  priceCents: number | null,
  currency: string,
  pricingType: CommunityPricingType
): CommunityPricingDisplay {
  if (pricingType === 'free' || priceCents === null || priceCents === 0) {
    return {
      type: 'free',
      price: 'Free',
      interval: null,
      buttonText: 'Join Free',
    };
  }

  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
  });

  const formattedPrice = formatter.format(priceCents / 100);

  if (pricingType === 'one_time') {
    return {
      type: 'one_time',
      price: formattedPrice,
      interval: null,
      buttonText: 'Buy Access',
    };
  }

  // monthly
  return {
    type: 'monthly',
    price: formattedPrice,
    interval: 'month',
    buttonText: 'Subscribe',
  };
}

/**
 * Check if a membership has valid paid access
 */
export function hasValidPaidAccess(membership: MembershipWithPayment): boolean {
  // Free communities always have access
  if (membership.payment_status === 'none') {
    return true;
  }

  // Must be paid
  if (membership.payment_status !== 'paid') {
    return false;
  }

  // Check expiration for subscriptions
  if (membership.expires_at) {
    const expiresAt = new Date(membership.expires_at);
    if (expiresAt < new Date()) {
      return false;
    }
  }

  return true;
}

/**
 * Determine if a community requires payment to join
 */
export function requiresPayment(community: CommunityWithPricing): boolean {
  if (community.pricing_type === 'free') return false;
  if (community.pricing_type === 'both') {
    return (community.price_cents !== null && community.price_cents > 0) ||
           (community.monthly_price_cents !== null && community.monthly_price_cents !== undefined && community.monthly_price_cents > 0);
  }
  return community.price_cents !== null && community.price_cents > 0;
}

// ============================================================================
// GATED COMMUNITY ACCESS TYPES
// ============================================================================

/**
 * How users can join a community
 * - open: Anyone can join instantly (current default behavior)
 * - gated: Users must apply and be approved by creator
 */
export type CommunityAccessType = 'open' | 'gated';

/**
 * Status of a community application
 * - pending: Waiting for creator review
 * - approved: Creator approved, user becomes member
 * - rejected: Creator rejected, user cannot reapply
 */
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

/**
 * Community application record
 */
export interface CommunityApplication {
  id: string;
  community_id: string;
  user_id: string;                    // profile.id of the applicant
  message: string | null;             // Optional intro message from applicant
  status: ApplicationStatus;
  applied_at: string;                 // ISO timestamp
  reviewed_at: string | null;         // ISO timestamp when reviewed
  reviewed_by: string | null;         // profile.id of reviewer (creator)
}

/**
 * Application with applicant profile info (for creator view)
 */
export interface ApplicationWithApplicant extends CommunityApplication {
  applicant: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email?: string;
  };
  community?: {
    id: string;
    name: string;
  };
}

/**
 * Community with access_type field
 */
export interface CommunityWithAccess extends CommunityWithPricing {
  access_type: CommunityAccessType;
}

/**
 * Check if a community requires application to join
 */
export function requiresApplication(community: { pricing_type: CommunityPricingType; access_type?: CommunityAccessType }): boolean {
  // Only free communities can be gated
  return community.pricing_type === 'free' && community.access_type === 'gated';
}
