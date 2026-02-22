// ============================================================================
// STRIPE SUBSCRIPTION EDGE FUNCTION
// Handles subscription management operations
// ============================================================================
//
// Endpoints:
// POST /stripe-subscription
//   - action: 'change-plan' - Upgrade or downgrade plan
//   - action: 'cancel' - Cancel subscription (at period end)
//   - action: 'resume' - Resume canceled subscription
//   - action: 'billing-portal' - Get Stripe Billing Portal URL
//
// Security:
// - All operations require valid JWT authentication
// - STRIPE_SECRET_KEY is never exposed to client
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { getUserFromToken, createServiceClient } from '../_shared/supabase.ts';
import { getStripeClient, PlanTier } from '../_shared/stripe.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, serverErrorResponse } from '../_shared/response.ts';

interface SubscriptionRequest {
  action: 'change-plan' | 'cancel' | 'resume' | 'billing-portal';
  // For change-plan
  newPlanTier?: PlanTier;
  // For billing-portal
  returnUrl?: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Only accept POST
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    const user = await getUserFromToken(authHeader);

    if (!user) {
      return unauthorizedResponse('Invalid or missing authentication token');
    }

    // Parse request body
    const body: SubscriptionRequest = await req.json();
    const { action } = body;

    if (!action) {
      return errorResponse('Missing action parameter');
    }

    // Initialize clients
    const stripe = getStripeClient();
    const supabase = createServiceClient();

    switch (action) {
      case 'change-plan': {
        return await handleChangePlan(stripe, supabase, user.userId, body);
      }
      case 'cancel': {
        return await handleCancelSubscription(stripe, supabase, user.userId);
      }
      case 'resume': {
        return await handleResumeSubscription(stripe, supabase, user.userId);
      }
      case 'billing-portal': {
        return await handleBillingPortal(stripe, supabase, user.userId, body);
      }
      default: {
        return errorResponse(`Unknown action: ${action}`);
      }
    }
  } catch (error) {
    console.error('Subscription error:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : 'Failed to process subscription request'
    );
  }
});

// ============================================================================
// CHANGE PLAN
// Handle plan upgrades and downgrades
// ============================================================================

async function handleChangePlan(
  stripe: ReturnType<typeof getStripeClient>,
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  body: SubscriptionRequest
): Promise<Response> {
  const { newPlanTier } = body;

  if (!newPlanTier) {
    return errorResponse('Missing newPlanTier');
  }

  // First get profile.id from auth user_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!profile) {
    return errorResponse('Profile not found');
  }

  const profileId = profile.id;

  // Get current billing state using profile.id
  const { data: billing } = await supabase
    .from('creator_billing')
    .select(`
      *,
      plan:billing_plans(*)
    `)
    .eq('creator_id', profileId)
    .single();

  if (!billing) {
    return errorResponse('No billing record found');
  }

  const currentPlan = billing.plan;

  // Get new plan details
  const { data: newPlan } = await supabase
    .from('billing_plans')
    .select('*')
    .eq('tier', newPlanTier)
    .eq('is_active', true)
    .single();

  if (!newPlan) {
    return errorResponse('Invalid plan');
  }

  // Downgrade to Starter = cancel subscription
  if (newPlanTier === 'starter') {
    if (!billing.stripe_subscription_id) {
      // No subscription to cancel, just update plan
      await supabase
        .from('creator_billing')
        .update({
          plan_id: newPlan.id,
          updated_at: new Date().toISOString(),
        })
        .eq('creator_id', profileId);

      return jsonResponse({
        success: true,
        effectiveDate: 'immediate',
      });
    }

    // Cancel subscription at period end
    const subscription = await stripe.subscriptions.update(
      billing.stripe_subscription_id,
      { cancel_at_period_end: true }
    );

    // Update database
    await supabase
      .from('creator_billing')
      .update({
        cancel_at_period_end: true,
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('creator_id', profileId);

    return jsonResponse({
      success: true,
      effectiveDate: new Date(subscription.current_period_end * 1000).toISOString(),
    });
  }

  // Check if subscription exists (has first sale)
  if (!billing.has_first_sale) {
    // No first sale yet - just update the plan, no subscription needed
    await supabase
      .from('creator_billing')
      .update({
        plan_id: newPlan.id,
        updated_at: new Date().toISOString(),
      })
      .eq('creator_id', profileId);

    return jsonResponse({
      success: true,
      effectiveDate: 'immediate',
    });
  }

  // Has first sale but no subscription yet - need to create one
  if (!billing.stripe_subscription_id) {
    // Return indication that subscription needs to be created
    return jsonResponse({
      success: true,
      requiresCheckout: true,
      message: 'Subscription checkout required',
    });
  }

  // Modify existing subscription
  const isUpgrade = newPlan.price_monthly_cents > currentPlan.price_monthly_cents;

  // Get the current subscription
  const subscription = await stripe.subscriptions.retrieve(billing.stripe_subscription_id);
  const subscriptionItemId = subscription.items.data[0]?.id;

  if (!subscriptionItemId) {
    return errorResponse('Subscription has no items');
  }

  // Update subscription with new price
  const updatedSubscription = await stripe.subscriptions.update(
    billing.stripe_subscription_id,
    {
      items: [
        {
          id: subscriptionItemId,
          price: newPlan.stripe_price_id!,
        },
      ],
      // Upgrade: prorate immediately. Downgrade: at period end
      proration_behavior: isUpgrade ? 'create_prorations' : 'none',
      metadata: {
        creator_id: profileId,
        plan_tier: newPlanTier,
        plan_id: newPlan.id,
      },
    }
  );

  // Update database
  await supabase
    .from('creator_billing')
    .update({
      plan_id: newPlan.id,
      cancel_at_period_end: false,
      canceled_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('creator_id', profileId);

  return jsonResponse({
    success: true,
    effectiveDate: isUpgrade
      ? 'immediate'
      : new Date(updatedSubscription.current_period_end * 1000).toISOString(),
  });
}

// ============================================================================
// CANCEL SUBSCRIPTION
// Cancel subscription at period end
// ============================================================================

async function handleCancelSubscription(
  stripe: ReturnType<typeof getStripeClient>,
  supabase: ReturnType<typeof createServiceClient>,
  userId: string
): Promise<Response> {
  // First get profile.id from auth user_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!profile) {
    return errorResponse('Profile not found');
  }

  const profileId = profile.id;

  // Get billing record using profile.id
  const { data: billing } = await supabase
    .from('creator_billing')
    .select('stripe_subscription_id, current_period_end')
    .eq('creator_id', profileId)
    .single();

  if (!billing?.stripe_subscription_id) {
    // No subscription to cancel
    return jsonResponse({
      success: true,
      effectiveDate: 'immediate',
    });
  }

  // Cancel at period end (not immediately)
  const subscription = await stripe.subscriptions.update(
    billing.stripe_subscription_id,
    { cancel_at_period_end: true }
  );

  // Update database using profile.id
  await supabase
    .from('creator_billing')
    .update({
      cancel_at_period_end: true,
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('creator_id', profileId);

  return jsonResponse({
    success: true,
    effectiveDate: new Date(subscription.current_period_end * 1000).toISOString(),
  });
}

// ============================================================================
// RESUME SUBSCRIPTION
// Resume a subscription that was canceled (before period end)
// ============================================================================

async function handleResumeSubscription(
  stripe: ReturnType<typeof getStripeClient>,
  supabase: ReturnType<typeof createServiceClient>,
  userId: string
): Promise<Response> {
  // First get profile.id from auth user_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!profile) {
    return errorResponse('Profile not found');
  }

  const profileId = profile.id;

  // Get billing record using profile.id
  const { data: billing } = await supabase
    .from('creator_billing')
    .select('stripe_subscription_id, cancel_at_period_end')
    .eq('creator_id', profileId)
    .single();

  if (!billing?.stripe_subscription_id) {
    return errorResponse('No subscription to resume');
  }

  if (!billing.cancel_at_period_end) {
    return errorResponse('Subscription is not canceled');
  }

  // Resume subscription
  await stripe.subscriptions.update(
    billing.stripe_subscription_id,
    { cancel_at_period_end: false }
  );

  // Update database using profile.id
  await supabase
    .from('creator_billing')
    .update({
      cancel_at_period_end: false,
      canceled_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('creator_id', profileId);

  return jsonResponse({
    success: true,
  });
}

// ============================================================================
// BILLING PORTAL
// Create Stripe Billing Portal session URL
// ============================================================================

async function handleBillingPortal(
  stripe: ReturnType<typeof getStripeClient>,
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  body: SubscriptionRequest
): Promise<Response> {
  const { returnUrl } = body;

  if (!returnUrl) {
    return errorResponse('Missing returnUrl');
  }

  // First get profile.id from auth user_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!profile) {
    return errorResponse('Profile not found');
  }

  const profileId = profile.id;

  // Get billing record using profile.id
  const { data: billing } = await supabase
    .from('creator_billing')
    .select('stripe_customer_id')
    .eq('creator_id', profileId)
    .single();

  if (!billing?.stripe_customer_id) {
    return errorResponse('No Stripe customer found');
  }

  // Create portal session
  const session = await stripe.billingPortal.sessions.create({
    customer: billing.stripe_customer_id,
    return_url: returnUrl,
  });

  return jsonResponse({
    url: session.url,
  });
}
