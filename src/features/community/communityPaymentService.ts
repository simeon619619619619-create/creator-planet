// ============================================================================
// COMMUNITY PAYMENT SERVICE
// Client-side service for community monetization with Stripe integration
// ============================================================================
//
// SECURITY NOTE:
// All Stripe API operations are performed via Supabase Edge Functions
// to keep STRIPE_SECRET_KEY server-side only. The client only handles:
// - Calling Edge Functions for backend operations
// - Database reads for community pricing and membership state
//
// IMPORTANT: Always use profile.id (NOT user.id) for all database queries.
// Database FK columns reference profiles.id, not auth.users.id.
// ============================================================================

import { supabase } from '../../core/supabase/client';
import {
  CommunityPricing,
  CommunityPricingFormData,
  CommunityCheckoutRequest,
  CommunityCheckoutResult,
  PaymentStatus,
} from './communityTypes';

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate that a profile ID is present and non-empty
 * IMPORTANT: Always pass profile.id from useAuth(), NOT user.id
 * Database FK columns reference profiles.id, not auth.users.id
 */
function validateProfileId(profileId: string | undefined | null, context: string): void {
  if (!profileId || typeof profileId !== 'string' || profileId.trim() === '') {
    throw new Error(
      `Invalid profile ID in ${context}. ` +
        'Ensure you are passing profile.id from useAuth(), not user.id.'
    );
  }
}

/**
 * Validate that a community ID is present and non-empty
 */
function validateCommunityId(communityId: string | undefined | null, context: string): void {
  if (!communityId || typeof communityId !== 'string' || communityId.trim() === '') {
    throw new Error(`Invalid community ID in ${context}.`);
  }
}

// ============================================================================
// COMMUNITY PRICING OPERATIONS
// ============================================================================

/**
 * Update community pricing settings
 * Only the creator can update pricing for their community
 *
 * @param communityId - The community to update
 * @param pricing - Form data with pricing_type, price (in whole units), and currency
 * @returns Success status and optional error message
 */
export async function updateCommunityPricing(
  communityId: string,
  pricing: CommunityPricingFormData
): Promise<{ success: boolean; error?: string }> {
  try {
    validateCommunityId(communityId, 'updateCommunityPricing');

    // Convert price from whole units (e.g., euros) to cents for database storage
    // Free communities have 0 price_cents
    const priceCents = pricing.pricing_type === 'free' ? 0 : Math.round(pricing.price * 100);
    const monthlyPriceCents = pricing.pricing_type === 'both' && pricing.monthlyPrice
      ? Math.round(pricing.monthlyPrice * 100)
      : 0;

    const { error } = await supabase
      .from('communities')
      .update({
        pricing_type: pricing.pricing_type,
        price_cents: priceCents,
        monthly_price_cents: monthlyPriceCents,
        currency: pricing.currency.toUpperCase(),
        // Clear Stripe IDs when pricing changes so they get regenerated on next checkout
        stripe_product_id: null,
        stripe_price_id: null,
        stripe_monthly_price_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', communityId);

    if (error) {
      console.error('Error updating community pricing:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in updateCommunityPricing:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update pricing',
    };
  }
}

/**
 * Get community pricing info
 *
 * @param communityId - The community to fetch pricing for
 * @returns CommunityPricing object or null if not found
 */
export async function getCommunityPricing(communityId: string): Promise<CommunityPricing | null> {
  try {
    validateCommunityId(communityId, 'getCommunityPricing');

    const { data, error } = await supabase
      .from('communities')
      .select('pricing_type, price_cents, currency, stripe_product_id, stripe_price_id, monthly_price_cents, stripe_monthly_price_id')
      .eq('id', communityId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No community found
        return null;
      }
      console.error('Error fetching community pricing:', error);
      return null;
    }

    return data as CommunityPricing;
  } catch (error) {
    console.error('Error in getCommunityPricing:', error);
    return null;
  }
}

// ============================================================================
// CHECKOUT OPERATIONS
// ============================================================================

/**
 * Create a Stripe Checkout session for community purchase
 * Calls the community-checkout Edge Function
 *
 * @param request - Checkout request with communityId, successUrl, and cancelUrl
 * @returns Checkout result with URL to redirect user to, or error
 */
export async function createCommunityCheckout(
  request: CommunityCheckoutRequest
): Promise<CommunityCheckoutResult> {
  try {
    validateCommunityId(request.communityId, 'createCommunityCheckout');

    // Use a direct fetch() instead of supabase.functions.invoke() so we have
    // complete control over the request headers. The Supabase gateway requires
    // BOTH `apikey` AND `Authorization: Bearer <jwt>` to be present; if either
    // is missing or empty it rejects the request with 401 before the edge
    // function ever runs.
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

    if (!accessToken) {
      return {
        success: false,
        error: 'Not authenticated. Please sign in and try again.',
      };
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/community-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        communityId: request.communityId,
        successUrl: request.successUrl,
        cancelUrl: request.cancelUrl,
        discountCode: request.discountCode,
        checkoutMode: request.checkoutMode, // Required when pricing_type is 'both'
        useWalletBalance: request.useWalletBalance,
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        error:
          (data && (data.error || data.message)) ||
          `Checkout request failed with status ${response.status}`,
      };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    if (!data) {
      return { success: false, error: 'No response from checkout service' };
    }

    return {
      success: true,
      checkoutUrl: data.checkout_url || data.checkoutUrl || data.url,
      sessionId: data.session_id || data.sessionId,
    };
  } catch (error) {
    console.error('Error creating community checkout:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create checkout',
    };
  }
}

// ============================================================================
// ACCESS VERIFICATION
// ============================================================================

/**
 * Check if user has valid paid access to a community
 * Handles free communities (always true), pending payments (false),
 * and subscription expiration checks
 *
 * @param communityId - The community to check access for
 * @param profileId - The user's profile.id (NOT user.id)
 * @returns true if user has valid access, false otherwise
 */
export async function hasValidCommunityAccess(
  communityId: string,
  profileId: string
): Promise<boolean> {
  try {
    validateCommunityId(communityId, 'hasValidCommunityAccess');
    validateProfileId(profileId, 'hasValidCommunityAccess');

    // First check if community is free (no payment needed)
    const pricing = await getCommunityPricing(communityId);
    if (pricing && pricing.pricing_type === 'free') {
      // For free communities, just check if they're a member
      const { data: membership } = await supabase
        .from('memberships')
        .select('id')
        .eq('community_id', communityId)
        .eq('user_id', profileId)
        .maybeSingle();

      return !!membership;
    }

    // For paid communities, check membership with payment status
    const { data: membership, error } = await supabase
      .from('memberships')
      .select('payment_status, expires_at')
      .eq('community_id', communityId)
      .eq('user_id', profileId)
      .maybeSingle();

    if (error) {
      console.error('Error checking community access:', error);
      return false;
    }

    if (!membership) {
      return false;
    }

    // Check payment status
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
  } catch (error) {
    console.error('Error in hasValidCommunityAccess:', error);
    return false;
  }
}

/**
 * Get user's membership payment status for a community
 *
 * @param communityId - The community to check
 * @param profileId - The user's profile.id (NOT user.id)
 * @returns Object with isMember, paymentStatus, and expiresAt
 */
export async function getMembershipPaymentStatus(
  communityId: string,
  profileId: string
): Promise<{ isMember: boolean; paymentStatus: PaymentStatus | null; expiresAt: string | null }> {
  try {
    validateCommunityId(communityId, 'getMembershipPaymentStatus');
    validateProfileId(profileId, 'getMembershipPaymentStatus');

    const { data: membership, error } = await supabase
      .from('memberships')
      .select('payment_status, expires_at')
      .eq('community_id', communityId)
      .eq('user_id', profileId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching membership payment status:', error);
      return { isMember: false, paymentStatus: null, expiresAt: null };
    }

    if (!membership) {
      return { isMember: false, paymentStatus: null, expiresAt: null };
    }

    return {
      isMember: true,
      paymentStatus: (membership.payment_status as PaymentStatus) || 'none',
      expiresAt: membership.expires_at,
    };
  } catch (error) {
    console.error('Error in getMembershipPaymentStatus:', error);
    return { isMember: false, paymentStatus: null, expiresAt: null };
  }
}

// ============================================================================
// PORTAL OPERATIONS
// ============================================================================

/**
 * Gets the Stripe Customer Portal URL for managing a community subscription.
 * Calls the community-portal edge function.
 *
 * @param communityId - The community whose subscription to manage
 * @returns Object with success status and portal URL or error
 */
export async function getCommunityPortalUrl(
  communityId: string
): Promise<{ success: boolean; portalUrl?: string; error?: string }> {
  try {
    validateCommunityId(communityId, 'getCommunityPortalUrl');

    const { data, error } = await supabase.functions.invoke('community-portal', {
      body: {
        communityId,
        returnUrl: window.location.href,
      },
    });

    if (error) {
      console.error('Error getting community portal URL:', error);
      return {
        success: false,
        error: error.message || 'Failed to get portal URL',
      };
    }

    if (!data) {
      return {
        success: false,
        error: 'No response from portal service',
      };
    }

    // Handle error response from edge function
    if (data.error) {
      console.error('Community portal error:', data.error);
      return {
        success: false,
        error: data.error,
      };
    }

    return {
      success: true,
      portalUrl: data.portalUrl || data.url,
    };
  } catch (err) {
    console.error('Exception in getCommunityPortalUrl:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
    };
  }
}

// ============================================================================
// PURCHASE HISTORY
// ============================================================================

/**
 * Get a user's community purchase history
 * Useful for displaying purchase receipts or transaction history
 *
 * @param profileId - The user's profile.id (NOT user.id)
 * @param options - Optional limit and offset for pagination
 * @returns Array of community purchases
 */
export async function getUserCommunityPurchases(
  profileId: string,
  options?: { limit?: number; offset?: number }
): Promise<
  Array<{
    id: string;
    community_id: string;
    community_name: string;
    amount_cents: number;
    currency: string;
    pricing_type: string;
    status: string;
    created_at: string;
  }>
> {
  try {
    validateProfileId(profileId, 'getUserCommunityPurchases');

    let query = supabase
      .from('community_purchases')
      .select(
        `
        id,
        community_id,
        amount_cents,
        currency,
        pricing_type,
        status,
        created_at,
        community:communities(name)
      `
      )
      .eq('user_id', profileId)
      .order('created_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching community purchases:', error);
      return [];
    }

    // Transform the data to flatten the community name
    return (data || []).map((purchase) => {
      // Handle the community join result - could be array or object depending on Supabase version
      const communityData = purchase.community;
      let communityName = 'Unknown Community';
      if (communityData) {
        if (Array.isArray(communityData) && communityData.length > 0) {
          communityName = communityData[0]?.name || 'Unknown Community';
        } else if (typeof communityData === 'object' && 'name' in communityData) {
          communityName = (communityData as { name: string }).name;
        }
      }
      return {
        id: purchase.id,
        community_id: purchase.community_id,
        community_name: communityName,
        amount_cents: purchase.amount_cents,
        currency: purchase.currency,
        pricing_type: purchase.pricing_type,
        status: purchase.status,
        created_at: purchase.created_at,
      };
    });
  } catch (error) {
    console.error('Error in getUserCommunityPurchases:', error);
    return [];
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format price from cents to display string
 *
 * @param cents - Amount in cents
 * @param currency - ISO 4217 currency code (e.g., 'EUR', 'USD')
 * @returns Formatted price string (e.g., "29,99 EUR")
 */
export function formatPrice(cents: number, currency: string = 'EUR'): string {
  const amount = cents / 100;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}

/**
 * Convert price from whole units to cents
 * Use when saving user input to database
 *
 * @param wholeUnits - Price in whole units (e.g., 29.99 euros)
 * @returns Price in cents (e.g., 2999)
 */
export function priceToCents(wholeUnits: number): number {
  return Math.round(wholeUnits * 100);
}

/**
 * Convert price from cents to whole units
 * Use when displaying database values in forms
 *
 * @param cents - Price in cents (e.g., 2999)
 * @returns Price in whole units (e.g., 29.99)
 */
export function centsToPrice(cents: number): number {
  return cents / 100;
}
