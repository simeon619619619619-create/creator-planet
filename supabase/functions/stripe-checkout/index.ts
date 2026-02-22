// ============================================================================
// STRIPE CHECKOUT EDGE FUNCTION
// Handles checkout session creation for activation fees and subscriptions
// ============================================================================
//
// Endpoints:
// POST /stripe-checkout
//   - action: 'activation' - Create activation fee checkout session
//   - action: 'subscription' - Create subscription checkout session
//   - action: 'payment-intent' - Create payment intent for product sales
//
// Security:
// - All operations require valid JWT authentication
// - STRIPE_SECRET_KEY is never exposed to client
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { getUserFromToken, createServiceClient } from '../_shared/supabase.ts';
import { getStripeClient, getStripeConfig, PlanTier } from '../_shared/stripe.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, serverErrorResponse } from '../_shared/response.ts';

interface CheckoutRequest {
  action: 'activation' | 'subscription' | 'payment-intent';
  // For activation
  creatorId?: string;
  successUrl?: string;
  cancelUrl?: string;
  // For subscription
  planTier?: PlanTier;
  // For payment-intent (product sales)
  amount?: number;
  productType?: string;
  productId?: string;
  productName?: string;
  buyerId?: string;
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
    const body: CheckoutRequest = await req.json();
    const { action } = body;

    if (!action) {
      return errorResponse('Missing action parameter');
    }

    // Initialize Stripe
    const stripe = getStripeClient();
    const supabase = createServiceClient();

    switch (action) {
      case 'activation': {
        return await handleActivationCheckout(stripe, supabase, user.userId, body);
      }
      case 'subscription': {
        return await handleSubscriptionCheckout(stripe, supabase, user.userId, body);
      }
      case 'payment-intent': {
        return await handlePaymentIntent(stripe, supabase, user.userId, body);
      }
      default: {
        return errorResponse(`Unknown action: ${action}`);
      }
    }
  } catch (error) {
    console.error('Checkout error:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : 'Failed to process checkout request'
    );
  }
});

// ============================================================================
// ACTIVATION FEE CHECKOUT
// Creates a one-time payment session for the EUR 9.90 activation fee
// Note: Exclusive plan creators are exempt from activation fee
// ============================================================================

async function handleActivationCheckout(
  stripe: ReturnType<typeof getStripeClient>,
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  body: CheckoutRequest
): Promise<Response> {
  const { successUrl, cancelUrl } = body;
  const creatorId = body.creatorId || userId;

  // Verify user is creating checkout for themselves (or has permission)
  if (creatorId !== userId) {
    return errorResponse('Cannot create checkout for another user', 403);
  }

  if (!successUrl || !cancelUrl) {
    return errorResponse('Missing successUrl or cancelUrl');
  }

  // Get or create Stripe customer
  const { data: billing } = await supabase
    .from('creator_billing')
    .select('stripe_customer_id, activation_fee_paid')
    .eq('creator_id', creatorId)
    .single();

  // Check if already paid
  if (billing?.activation_fee_paid) {
    return errorResponse('Activation fee already paid');
  }

  let customerId = billing?.stripe_customer_id;

  // Get user email for Stripe customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', creatorId)
    .single();

  if (!customerId && profile?.email) {
    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email: profile.email,
      name: profile.full_name || undefined,
      metadata: {
        creator_id: creatorId,
        platform: 'creator_club',
      },
    });
    customerId = customer.id;

    // Save customer ID to database
    await supabase
      .from('creator_billing')
      .update({ stripe_customer_id: customerId })
      .eq('creator_id', creatorId);
  }

  // Create checkout session (uses mode-aware config)
  const stripeConfig = getStripeConfig();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customerId || undefined,
    customer_email: !customerId ? profile?.email : undefined,
    line_items: [
      {
        price: stripeConfig.activation.priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl.replace('{CHECKOUT_SESSION_ID}', '{CHECKOUT_SESSION_ID}'),
    cancel_url: cancelUrl,
    metadata: {
      type: 'activation_fee',
      creator_id: creatorId,
    },
    payment_intent_data: {
      metadata: {
        type: 'activation_fee',
        creator_id: creatorId,
      },
    },
  });

  return jsonResponse({
    url: session.url,
    sessionId: session.id,
  });
}

// ============================================================================
// SUBSCRIPTION CHECKOUT
// Creates a subscription checkout session for Pro/Scale plans
// ============================================================================

async function handleSubscriptionCheckout(
  stripe: ReturnType<typeof getStripeClient>,
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  body: CheckoutRequest
): Promise<Response> {
  const { successUrl, cancelUrl, planTier } = body;
  const creatorId = body.creatorId || userId;

  // Verify user is creating checkout for themselves
  if (creatorId !== userId) {
    return errorResponse('Cannot create checkout for another user', 403);
  }

  if (!successUrl || !cancelUrl) {
    return errorResponse('Missing successUrl or cancelUrl');
  }

  if (!planTier || !['pro', 'scale'].includes(planTier)) {
    return errorResponse('Invalid plan tier. Must be "pro" or "scale"');
  }

  // Get billing record with customer ID
  const { data: billing } = await supabase
    .from('creator_billing')
    .select('stripe_customer_id, plan_id')
    .eq('creator_id', creatorId)
    .single();

  if (!billing?.stripe_customer_id) {
    return errorResponse('No Stripe customer found. Please complete activation first.');
  }

  // Get plan details from database (for plan ID and validation)
  const { data: plan } = await supabase
    .from('billing_plans')
    .select('id, tier')
    .eq('tier', planTier)
    .eq('is_active', true)
    .single();

  if (!plan) {
    return errorResponse('Plan not found');
  }

  // Get price ID from config (automatically uses test or live mode)
  const stripeConfig = getStripeConfig();
  const planConfig = stripeConfig.plans[planTier as 'pro' | 'scale'];

  if (!planConfig?.priceId) {
    return errorResponse('Plan price not configured');
  }

  // Create subscription checkout session
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: billing.stripe_customer_id,
    line_items: [
      {
        price: planConfig.priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        creator_id: creatorId,
        plan_tier: planTier,
        plan_id: plan.id,
      },
    },
    metadata: {
      type: 'plan_subscription',
      creator_id: creatorId,
      plan_tier: planTier,
    },
  });

  return jsonResponse({
    url: session.url,
    sessionId: session.id,
  });
}

// ============================================================================
// PAYMENT INTENT
// Creates a payment intent for product sales with Connect transfers
// ============================================================================

async function handlePaymentIntent(
  stripe: ReturnType<typeof getStripeClient>,
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  body: CheckoutRequest
): Promise<Response> {
  const { amount, productType, productId, productName, buyerId } = body;
  const creatorId = body.creatorId;

  if (!creatorId) {
    return errorResponse('Missing creatorId');
  }

  if (!amount || amount < 100) {
    return errorResponse('Invalid amount. Minimum is 100 cents (EUR 1.00)');
  }

  if (!productType || !productName) {
    return errorResponse('Missing product information');
  }

  // Get creator's billing info (Connect account and plan)
  const { data: billing } = await supabase
    .from('creator_billing')
    .select(`
      stripe_account_id,
      stripe_account_status,
      plan:billing_plans(tier, platform_fee_percent)
    `)
    .eq('creator_id', creatorId)
    .single();

  if (!billing?.stripe_account_id) {
    return errorResponse('Creator has not set up payouts');
  }

  if (billing.stripe_account_status !== 'active') {
    return errorResponse('Creator payout account is not active');
  }

  // Calculate platform fee
  const feePercent = billing.plan?.platform_fee_percent || 6.9;
  const applicationFeeAmount = Math.round(amount * (feePercent / 100));

  // Create payment intent with Connect destination
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'eur',
    application_fee_amount: applicationFeeAmount,
    transfer_data: {
      destination: billing.stripe_account_id,
    },
    metadata: {
      product_type: productType,
      product_id: productId || '',
      product_name: productName,
      creator_id: creatorId,
      buyer_id: buyerId || userId,
      platform_fee_cents: applicationFeeAmount.toString(),
    },
  });

  return jsonResponse({
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  });
}
