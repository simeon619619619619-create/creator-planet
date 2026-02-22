// ============================================================================
// STRIPE SERVICE
// Complete Stripe integration for Creator Club billing
// ============================================================================
//
// SECURITY NOTE:
// All Stripe API operations are performed via Supabase Edge Functions
// to keep STRIPE_SECRET_KEY server-side only. The client only handles:
// - Stripe.js for payment UI (public key only)
// - Calling Edge Functions for backend operations
// - Database reads for billing state
// ============================================================================

import { loadStripe, Stripe as StripeJS } from '@stripe/stripe-js';
import { supabase } from '../../core/supabase/client';
import {
  PlanTier,
  BillingStatus,
  BillingPlan,
  CreatorBilling,
  BillingTransaction,
  CreatorSale,
  TransactionType,
  ProductType,
  CheckoutResult,
  SubscriptionResult,
  PlanChangeResult,
  ConnectOnboardingResult,
  PaymentIntentResult,
  FeeCalculation,
  PlanDisplayInfo,
  BillingDashboardData,
  ConnectAccountStatus,
  STRIPE_CONFIG,
  PLAN_LIMITS,
} from './stripeTypes';

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

// ============================================================================
// STRIPE INITIALIZATION
// ============================================================================

let stripePromise: Promise<StripeJS | null> | null = null;

/**
 * Initialize and get the Stripe client
 * Uses singleton pattern to avoid multiple initializations
 */
export function initStripe(): Promise<StripeJS | null> {
  if (!stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
    if (!key) {
      console.error('Missing VITE_STRIPE_PUBLIC_KEY environment variable');
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}

/**
 * Get the Stripe client, throwing if not available
 */
export async function getStripe(): Promise<StripeJS> {
  const stripe = await initStripe();
  if (!stripe) {
    throw new Error('Stripe failed to initialize');
  }
  return stripe;
}

// ============================================================================
// PLAN OPERATIONS
// ============================================================================

/**
 * Get all available billing plans from the database
 */
export async function getPlans(): Promise<BillingPlan[]> {
  const { data, error } = await supabase
    .from('billing_plans')
    .select('*')
    .eq('is_active', true)
    .order('price_monthly_cents', { ascending: true });

  if (error) {
    console.error('Error fetching plans:', error);
    return [];
  }
  return data || [];
}

/**
 * Get a specific plan by tier
 */
export async function getPlanByTier(tier: PlanTier): Promise<BillingPlan | null> {
  const { data, error } = await supabase
    .from('billing_plans')
    .select('*')
    .eq('tier', tier)
    .eq('is_active', true)
    .single();

  if (error) {
    console.error('Error fetching plan:', error);
    return null;
  }
  return data;
}

/**
 * Get plan display info for UI
 */
export function getPlanDisplayInfo(plan: BillingPlan): PlanDisplayInfo {
  const features: string[] = [];
  const limits = plan.features;

  // Build feature list
  if (limits.max_students === -1) {
    features.push('Unlimited students');
  } else {
    features.push(`Up to ${limits.max_students} students`);
  }

  if (limits.max_courses === -1) {
    features.push('Unlimited courses');
  } else {
    features.push(`Up to ${limits.max_courses} courses`);
  }

  if (limits.max_communities === -1) {
    features.push('Unlimited communities');
  } else {
    features.push(`${limits.max_communities} ${limits.max_communities === 1 ? 'community' : 'communities'}`);
  }

  if (limits.ai_enabled) features.push('AI Success Manager');
  if (limits.custom_branding) features.push('Custom branding');
  if (limits.priority_support) features.push('Priority support');
  if (limits.white_label) features.push('White label');
  if (limits.advanced_analytics) features.push('Advanced analytics');
  if (limits.api_access) features.push('API access');

  return {
    tier: plan.tier,
    name: plan.name,
    priceMonthly: plan.price_monthly_cents === 0 ? 'Free' : formatAmount(plan.price_monthly_cents),
    platformFee: `${plan.platform_fee_percent}%`,
    features,
    recommended: plan.tier === 'pro',
    breakEvenRevenue: calculateBreakEvenDisplay(plan.tier),
  };
}

/**
 * Get all plans with display info
 */
export async function getPlansWithDisplayInfo(): Promise<PlanDisplayInfo[]> {
  const plans = await getPlans();
  return plans.map(getPlanDisplayInfo);
}

// ============================================================================
// CREATOR BILLING OPERATIONS
// ============================================================================

/**
 * Get creator's current billing state
 */
export async function getCreatorBilling(creatorId: string): Promise<CreatorBilling | null> {
  // Validate profile ID before database query
  if (!creatorId || typeof creatorId !== 'string' || creatorId.trim() === '') {
    console.error('getCreatorBilling: Invalid creatorId provided');
    return null;
  }

  const { data, error } = await supabase
    .from('creator_billing')
    .select(`
      *,
      plan:billing_plans(*)
    `)
    .eq('creator_id', creatorId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No billing record found
      return null;
    }
    console.error('Error fetching creator billing:', error);
    return null;
  }
  return data;
}

/**
 * Check if activation fee is paid
 */
export async function isActivationPaid(creatorId: string): Promise<boolean> {
  const billing = await getCreatorBilling(creatorId);
  return billing?.activation_fee_paid ?? false;
}

/**
 * Get full billing dashboard data
 */
export async function getBillingDashboard(creatorId: string): Promise<BillingDashboardData | null> {
  // Validation handled by getCreatorBilling
  const billing = await getCreatorBilling(creatorId);
  if (!billing || !billing.plan) {
    return null;
  }

  // Get current period dates
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Get current period revenue
  const { data: periodSales } = await supabase
    .from('creator_sales')
    .select('sale_amount_cents, platform_fee_cents')
    .eq('creator_id', creatorId)
    .eq('status', 'completed')
    .gte('created_at', startOfMonth.toISOString())
    .lte('created_at', endOfMonth.toISOString());

  const currentPeriodRevenue = periodSales?.reduce((sum, s) => sum + s.sale_amount_cents, 0) || 0;
  const platformFeesThisPeriod = periodSales?.reduce((sum, s) => sum + s.platform_fee_cents, 0) || 0;

  // Get total revenue
  const { data: totalSales } = await supabase
    .from('creator_sales')
    .select('sale_amount_cents')
    .eq('creator_id', creatorId)
    .eq('status', 'completed');

  const totalRevenue = totalSales?.reduce((sum, s) => sum + s.sale_amount_cents, 0) || 0;

  // Get recent transactions
  const { data: recentTransactions } = await supabase
    .from('billing_transactions')
    .select('*')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })
    .limit(10);

  return {
    currentPlan: billing.plan,
    billing,
    currentPeriodRevenue,
    platformFeesThisPeriod,
    totalRevenue,
    recentTransactions: recentTransactions || [],
    nextInvoiceDate: billing.current_period_end,
    nextInvoiceAmount: billing.monthly_fee_active ? billing.plan.price_monthly_cents : null,
  };
}

// ============================================================================
// CHECKOUT & PAYMENT OPERATIONS
// ============================================================================

/**
 * Create checkout session for activation fee (€9.90)
 * Returns checkout URL for redirect
 */
export async function createActivationCheckout(creatorId: string): Promise<CheckoutResult> {
  try {
    // Validate profile ID before making Edge Function call
    validateProfileId(creatorId, 'createActivationCheckout');

    // Call Edge Function to create checkout session
    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: {
        action: 'activation',
        creatorId,
        successUrl: `${window.location.origin}/onboarding?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/onboarding?canceled=true`,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to create checkout session');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return { success: true, checkoutUrl: data.url, sessionId: data.sessionId };
  } catch (error) {
    console.error('Error creating activation checkout:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create checkout',
    };
  }
}

/**
 * Create subscription checkout for plan (Pro/Scale)
 * Only used after first sale when monthly fee needs to activate
 */
export async function createPlanSubscription(
  creatorId: string,
  planId: PlanTier
): Promise<SubscriptionResult> {
  try {
    // Validate profile ID before making Edge Function call
    validateProfileId(creatorId, 'createPlanSubscription');

    // Call Edge Function to create subscription checkout
    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: {
        action: 'subscription',
        creatorId,
        planTier: planId,
        successUrl: `${window.location.origin}/settings?tab=billing&success=true`,
        cancelUrl: `${window.location.origin}/settings?tab=billing&canceled=true`,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to create subscription checkout');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return { success: true, checkoutUrl: data.url, subscriptionId: data.sessionId };
  } catch (error) {
    console.error('Error creating subscription checkout:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create subscription',
    };
  }
}

// ============================================================================
// PLAN CHANGE OPERATIONS
// ============================================================================

/**
 * Change creator's plan
 * - Upgrades: Immediate proration
 * - Downgrades: Takes effect at period end
 */
export async function changePlan(
  creatorId: string,
  newPlanId: PlanTier
): Promise<PlanChangeResult> {
  try {
    // Validate profile ID before database/API operations
    validateProfileId(creatorId, 'changePlan');

    const billing = await getCreatorBilling(creatorId);
    if (!billing) {
      return { success: false, error: 'No billing record found' };
    }

    const currentPlan = billing.plan;
    const newPlan = await getPlanByTier(newPlanId);

    if (!currentPlan || !newPlan) {
      return { success: false, error: 'Invalid plan' };
    }

    // Determine if upgrade or downgrade
    const isUpgrade = newPlan.price_monthly_cents > currentPlan.price_monthly_cents;

    if (newPlanId === 'starter') {
      // Downgrading to Starter - cancel subscription
      return cancelSubscription(creatorId);
    }

    if (!billing.has_first_sale) {
      // No first sale yet - just update the plan, no subscription action needed
      const { error } = await supabase
        .from('creator_billing')
        .update({
          plan_id: newPlan.id,
          updated_at: new Date().toISOString(),
        })
        .eq('creator_id', creatorId);

      if (error) {
        throw error;
      }

      return {
        success: true,
        effectiveDate: 'immediate',
      };
    }

    // Has first sale - need to modify subscription via Edge Function
    const { data, error } = await supabase.functions.invoke('stripe-subscription', {
      body: {
        action: 'change-plan',
        newPlanTier: newPlanId,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to change plan');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    // If checkout is required (no subscription yet), return that info
    if (data?.requiresCheckout) {
      return {
        success: true,
        requiresCheckout: true,
      };
    }

    return {
      success: true,
      effectiveDate: data?.effectiveDate || (isUpgrade ? 'immediate' : 'period_end'),
    };
  } catch (error) {
    console.error('Error changing plan:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to change plan',
    };
  }
}

/**
 * Cancel subscription (takes effect at period end)
 */
export async function cancelSubscription(creatorId: string): Promise<PlanChangeResult> {
  try {
    // Call Edge Function to cancel subscription
    const { data, error } = await supabase.functions.invoke('stripe-subscription', {
      body: {
        action: 'cancel',
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to cancel subscription');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return {
      success: true,
      effectiveDate: data?.effectiveDate || 'unknown',
    };
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel subscription',
    };
  }
}

/**
 * Resume a canceled subscription (before period end)
 */
export async function resumeSubscription(creatorId: string): Promise<PlanChangeResult> {
  try {
    // Call Edge Function to resume subscription
    const { data, error } = await supabase.functions.invoke('stripe-subscription', {
      body: {
        action: 'resume',
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to resume subscription');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return { success: true };
  } catch (error) {
    console.error('Error resuming subscription:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resume subscription',
    };
  }
}

/**
 * Get Stripe Billing Portal URL for customer
 */
export async function getBillingPortalUrl(creatorId: string): Promise<string | null> {
  try {
    // Call Edge Function to create billing portal session
    const { data, error } = await supabase.functions.invoke('stripe-subscription', {
      body: {
        action: 'billing-portal',
        returnUrl: `${window.location.origin}/settings/billing`,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to create billing portal');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data?.url || null;
  } catch (error) {
    console.error('Error getting billing portal URL:', error);
    return null;
  }
}

// ============================================================================
// PLATFORM FEE CALCULATIONS
// ============================================================================

/**
 * Calculate platform fee for a sale based on creator's plan
 */
export async function calculatePlatformFee(
  amount: number,
  planId: PlanTier
): Promise<FeeCalculation> {
  const plan = await getPlanByTier(planId);
  const feePercent = plan?.platform_fee_percent ?? STRIPE_CONFIG.plans.starter.platformFeePercent;
  const feeAmount = Math.round(amount * (feePercent / 100));
  const netAmount = amount - feeAmount;

  return {
    feeAmount,
    feePercent,
    netAmount,
  };
}

/**
 * Calculate platform fee synchronously using config (no DB lookup)
 */
export function calculatePlatformFeeSync(
  amount: number,
  planTier: PlanTier
): FeeCalculation {
  const feePercent = STRIPE_CONFIG.plans[planTier]?.platformFeePercent ?? 6.9;
  const feeAmount = Math.round(amount * (feePercent / 100));
  const netAmount = amount - feeAmount;

  return {
    feeAmount,
    feePercent,
    netAmount,
  };
}

// ============================================================================
// STRIPE CONNECT OPERATIONS
// ============================================================================

/**
 * Create Stripe Connect account for creator
 */
export async function createConnectAccount(
  creatorId: string,
  email: string,
  country: string = 'BG'
): Promise<ConnectOnboardingResult> {
  try {
    // Validate profile ID before making Edge Function call
    validateProfileId(creatorId, 'createConnectAccount');

    // Call Edge Function to create Connect account
    const { data, error } = await supabase.functions.invoke('stripe-connect', {
      body: {
        action: 'create-account',
      },
    });

    // Check for error in response data first (edge function returns JSON error body)
    // Then check for invoke error (network/auth issues)
    if (data?.error) {
      throw new Error(data.error);
    }

    if (error) {
      throw new Error(error.message || 'Failed to create Connect account');
    }

    // If account already exists, still return success
    if (data?.alreadyExists) {
      return {
        success: true,
        accountId: data.accountId,
      };
    }

    return {
      success: true,
      accountId: data?.accountId,
    };
  } catch (error) {
    console.error('Error creating Connect account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create Connect account',
    };
  }
}

/**
 * Get Connect onboarding link for incomplete onboarding
 */
export async function getConnectOnboardingLink(creatorId: string): Promise<string | null> {
  try {
    // Validate profile ID before making Edge Function call
    validateProfileId(creatorId, 'getConnectOnboardingLink');

    // Call Edge Function to get onboarding link
    const { data, error } = await supabase.functions.invoke('stripe-connect', {
      body: {
        action: 'onboarding-link',
        returnUrl: `${window.location.origin}/settings/billing`,
        refreshUrl: `${window.location.origin}/settings/billing?refresh=true`,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to get onboarding link');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data?.url || null;
  } catch (error) {
    console.error('Error getting Connect onboarding link:', error);
    return null;
  }
}

/**
 * Get Connect account status
 */
export async function getConnectAccountStatus(
  creatorId: string
): Promise<ConnectAccountStatus | null> {
  try {
    // Validate profile ID before making Edge Function call
    validateProfileId(creatorId, 'getConnectAccountStatus');

    // Call Edge Function to get account status
    const { data, error } = await supabase.functions.invoke('stripe-connect', {
      body: {
        action: 'account-status',
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to get account status');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    if (!data?.hasAccount) {
      return null;
    }

    return {
      accountId: data.accountId,
      status: data.status,
      chargesEnabled: data.chargesEnabled,
      payoutsEnabled: data.payoutsEnabled,
      detailsSubmitted: data.detailsSubmitted,
      requirements: data.requirements,
    };
  } catch (error) {
    console.error('Error getting Connect account status:', error);
    return null;
  }
}

// ============================================================================
// SALE PROCESSING
// ============================================================================

/**
 * Create payment intent for a creator's product sale
 * Uses Stripe Connect to automatically split the payment
 */
export async function createSalePaymentIntent(
  creatorId: string,
  buyerId: string,
  product: { type: ProductType; id: string; name: string; price: number }
): Promise<PaymentIntentResult> {
  try {
    // Validate both profile IDs before making Edge Function call
    validateProfileId(creatorId, 'createSalePaymentIntent (creatorId)');
    validateProfileId(buyerId, 'createSalePaymentIntent (buyerId)');

    // Call Edge Function to create payment intent
    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: {
        action: 'payment-intent',
        creatorId,
        buyerId,
        amount: product.price,
        productType: product.type,
        productId: product.id,
        productName: product.name,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to create payment intent');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return {
      success: true,
      clientSecret: data?.clientSecret,
      paymentIntentId: data?.paymentIntentId,
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create payment intent',
    };
  }
}

// ============================================================================
// FIRST SALE TRIGGER
// ============================================================================

/**
 * Handle first sale - triggers monthly fee for Pro/Scale
 * Called when a creator makes their first successful sale
 */
export async function handleFirstSale(creatorId: string): Promise<void> {
  // Validate profile ID before database operations
  if (!creatorId || typeof creatorId !== 'string' || creatorId.trim() === '') {
    console.error('handleFirstSale: Invalid creatorId provided');
    return;
  }

  const billing = await getCreatorBilling(creatorId);
  if (!billing || billing.has_first_sale) {
    return; // Already handled or no billing record
  }

  // Update first sale flag
  const { error } = await supabase
    .from('creator_billing')
    .update({
      has_first_sale: true,
      first_sale_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('creator_id', creatorId);

  if (error) {
    console.error('Error updating first sale flag:', error);
    return;
  }

  // If on Pro or Scale, activate monthly fee
  if (billing.plan?.tier !== 'starter') {
    await activateMonthlyFee(creatorId);
  }
}

/**
 * Activate monthly fee subscription for Pro/Scale
 */
export async function activateMonthlyFee(
  creatorId: string
): Promise<{ activated: boolean; checkoutUrl?: string }> {
  const billing = await getCreatorBilling(creatorId);
  if (!billing || billing.monthly_fee_active) {
    return { activated: false };
  }

  if (billing.plan?.tier === 'starter') {
    return { activated: false }; // Starter has no monthly fee
  }

  // Create subscription checkout
  const result = await createPlanSubscription(creatorId, billing.plan?.tier || 'pro');

  if (result.success && result.checkoutUrl) {
    return { activated: true, checkoutUrl: result.checkoutUrl };
  }

  return { activated: false };
}

// ============================================================================
// TRANSACTION HISTORY
// ============================================================================

/**
 * Get creator's transaction history
 */
export async function getTransactions(
  creatorId: string,
  options?: { limit?: number; offset?: number; type?: TransactionType }
): Promise<BillingTransaction[]> {
  let query = supabase
    .from('billing_transactions')
    .select('*')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false });

  if (options?.type) {
    query = query.eq('type', options.type);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
  return data || [];
}

/**
 * Get creator's sales history
 */
export async function getSales(
  creatorId: string,
  options?: { limit?: number; offset?: number; startDate?: string; endDate?: string }
): Promise<CreatorSale[]> {
  let query = supabase
    .from('creator_sales')
    .select('*')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false });

  if (options?.startDate) {
    query = query.gte('created_at', options.startDate);
  }
  if (options?.endDate) {
    query = query.lte('created_at', options.endDate);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching sales:', error);
    return [];
  }
  return data || [];
}

/**
 * Get revenue analytics for a period
 */
export async function getRevenueAnalytics(
  creatorId: string,
  period: 'day' | 'week' | 'month' | 'year'
): Promise<{
  totalRevenue: number;
  platformFees: number;
  netRevenue: number;
  salesCount: number;
  averageSale: number;
}> {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case 'day':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
  }

  const { data: sales } = await supabase
    .from('creator_sales')
    .select('sale_amount_cents, platform_fee_cents, net_amount_cents')
    .eq('creator_id', creatorId)
    .eq('status', 'completed')
    .gte('created_at', startDate.toISOString());

  if (!sales || sales.length === 0) {
    return {
      totalRevenue: 0,
      platformFees: 0,
      netRevenue: 0,
      salesCount: 0,
      averageSale: 0,
    };
  }

  const totalRevenue = sales.reduce((sum, s) => sum + s.sale_amount_cents, 0);
  const platformFees = sales.reduce((sum, s) => sum + s.platform_fee_cents, 0);
  const netRevenue = sales.reduce((sum, s) => sum + s.net_amount_cents, 0);

  return {
    totalRevenue,
    platformFees,
    netRevenue,
    salesCount: sales.length,
    averageSale: Math.round(totalRevenue / sales.length),
  };
}

// ============================================================================
// WEBHOOK PROCESSING - DEPRECATED
// ============================================================================
//
// IMPORTANT: Webhook processing is now handled by the Supabase Edge Function
// at supabase/functions/stripe-webhook/index.ts
//
// The Edge Function:
// - Verifies webhook signatures using STRIPE_WEBHOOK_SECRET
// - Provides idempotent processing via webhook_events table
// - Handles all event types securely on the server side
//
// This client-side code is deprecated and should NOT be used.
// It is kept only for reference during the transition period.
// ============================================================================

/**
 * @deprecated Use the stripe-webhook Edge Function instead.
 * This function lacks proper webhook signature verification.
 *
 * Webhooks should be received at: /functions/v1/stripe-webhook
 * Configure this URL in your Stripe Dashboard > Webhooks
 */
export async function processWebhookEvent(
  _event: { id: string; type: string; data: { object: Record<string, unknown> } }
): Promise<{ processed: boolean; error?: string }> {
  console.warn(
    'DEPRECATED: processWebhookEvent is deprecated. ' +
    'Webhooks are now processed by the stripe-webhook Edge Function with proper signature verification.'
  );
  return {
    processed: false,
    error: 'Client-side webhook processing is deprecated. Use the stripe-webhook Edge Function.',
  };
}

/**
 * @deprecated Webhook handlers have moved to the stripe-webhook Edge Function.
 * See: supabase/functions/stripe-webhook/index.ts
 */
export const webhookHandlers = {
  // All handlers have been moved to the Edge Function
  // This object is kept for backwards compatibility only
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format amount from cents to display string
 */
export function formatAmount(cents: number, currency: string = 'EUR'): string {
  const amount = cents / 100;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Get recommended plan based on monthly revenue
 */
export function getRecommendedPlan(monthlyRevenue: number): PlanTier {
  // Break-even calculations from architecture design:
  // Starter→Pro at ~€750/mo revenue (750 * 6.9% = 51.75 vs 30 + 750 * 3.9% = 59.25)
  // Pro→Scale at ~€6,900/mo revenue (6900 * 3.9% = 269.1 vs 99 + 6900 * 1.9% = 230.1)

  if (monthlyRevenue >= 690000) {
    // €6,900 in cents
    return 'scale';
  } else if (monthlyRevenue >= 75000) {
    // €750 in cents
    return 'pro';
  }
  return 'starter';
}

/**
 * Calculate break-even point for plan upgrade
 */
export function calculateBreakEven(currentTier: PlanTier, targetTier: PlanTier): number {
  const current = STRIPE_CONFIG.plans[currentTier];
  const target = STRIPE_CONFIG.plans[targetTier];

  if (!current || !target) return 0;

  // Break-even formula:
  // current_fee% * revenue = target_monthly + target_fee% * revenue
  // revenue * (current_fee - target_fee) = target_monthly
  // revenue = target_monthly / (current_fee - target_fee)

  const feeDifference = current.platformFeePercent - target.platformFeePercent;
  if (feeDifference <= 0) return 0;

  const breakEvenRevenue = (target.monthlyAmount / (feeDifference / 100));
  return Math.round(breakEvenRevenue);
}

/**
 * Get break-even display string
 */
function calculateBreakEvenDisplay(tier: PlanTier): string | undefined {
  switch (tier) {
    case 'pro':
      return '~€750/month';
    case 'scale':
      return '~€6,900/month';
    default:
      return undefined;
  }
}

/**
 * Check if a feature is available on a plan
 */
export function isPlanFeatureAvailable(
  tier: PlanTier,
  feature: keyof typeof PLAN_LIMITS.starter
): boolean {
  const limits = PLAN_LIMITS[tier];
  return !!limits[feature];
}

/**
 * Get plan limit for a specific resource
 */
export function getPlanLimit(
  tier: PlanTier,
  resource: 'max_students' | 'max_courses' | 'max_communities'
): number {
  return PLAN_LIMITS[tier][resource];
}

// ============================================================================
// BALANCE & WITHDRAWAL OPERATIONS
// ============================================================================

export interface BalanceData {
  pending: number;
  available: number;
  reserved: number;
  negative: number;
  withdrawable: number;
}

export interface NextRelease {
  date: string;
  amount: number;
}

export interface ReserveRelease {
  amount_cents: number;
  release_at: string;
}

export interface WithdrawalBlocker {
  reason: 'COOLDOWN_ACTIVE' | 'BELOW_MINIMUM' | 'CONNECT_NOT_ACTIVE' | 'NEGATIVE_BALANCE';
  message: string;
  cooldownEndsAt?: string;
  currentAmount?: number;
  minimumAmount?: number;
}

export interface WithdrawalEligibility {
  allowed: boolean;
  reason?: string;
  message: string;
  cooldownEndsAt?: string;
  currentAmount?: number;
  minimumAmount?: number;
}

export interface BalanceStatus {
  balances: BalanceData;
  eligibility: WithdrawalEligibility;
  nextPendingRelease: NextRelease | null;
  reserveReleases: ReserveRelease[];
  connectStatus: string | null;
}

export interface WithdrawalResult {
  success: boolean;
  payout?: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    transferId: string;
  };
  newBalance?: {
    available: number;
    negative: number;
  };
  error?: string;
}

export interface Payout {
  id: string;
  creator_id: string;
  amount_cents: number;
  currency: string;
  type: 'automatic' | 'manual';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stripe_transfer_id: string | null;
  stripe_payout_id: string | null;
  failure_code: string | null;
  failure_message: string | null;
  retry_count: number;
  created_at: string;
  processing_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
}

/**
 * Get creator's balance status and withdrawal eligibility
 */
export async function getBalanceStatus(creatorId: string): Promise<BalanceStatus | null> {
  try {
    validateProfileId(creatorId, 'getBalanceStatus');

    const { data, error } = await supabase.functions.invoke('creator-withdrawal', {
      body: {
        action: 'status',
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to get balance status');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
  } catch (error) {
    console.error('Error getting balance status:', error);
    return null;
  }
}

/**
 * Request a manual withdrawal
 */
export async function requestWithdrawal(creatorId: string): Promise<WithdrawalResult> {
  try {
    validateProfileId(creatorId, 'requestWithdrawal');

    const { data, error } = await supabase.functions.invoke('creator-withdrawal', {
      body: {
        action: 'withdraw',
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to process withdrawal');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
  } catch (error) {
    console.error('Error requesting withdrawal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process withdrawal',
    };
  }
}

/**
 * Get payout history for creator
 */
export async function getPayoutHistory(
  creatorId: string,
  options?: { limit?: number; offset?: number }
): Promise<Payout[]> {
  try {
    validateProfileId(creatorId, 'getPayoutHistory');

    let query = supabase
      .from('payouts')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching payout history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting payout history:', error);
    return [];
  }
}
