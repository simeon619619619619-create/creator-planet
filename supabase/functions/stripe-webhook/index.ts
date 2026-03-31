// ============================================================================
// STRIPE WEBHOOK EDGE FUNCTION
// Handles all Stripe webhook events with signature verification
// ============================================================================
//
// CRITICAL SECURITY:
// - Verifies webhook signature using STRIPE_WEBHOOK_SECRET
// - Idempotent processing using webhook_events table
// - All database operations use service role
//
// Money flow: Stripe Connect destination charges with application_fee_amount.
// Stripe handles all payouts directly — no wallet/balance tracking here.
//
// Handled Events:
// - checkout.session.completed (activation fee, community purchase, student plus)
// - invoice.paid / invoice.payment_failed
// - customer.subscription.created/updated/deleted
// - payment_intent.succeeded (analytics-only sale recording)
// - account.updated (Connect)
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { getStripeClient, getWebhookSecret, getStripeConfig } from '../_shared/stripe.ts';
import { jsonResponse, errorResponse, serverErrorResponse } from '../_shared/response.ts';

// Type definitions
interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight (though webhooks don't usually need it)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const stripe = getStripeClient();
  const supabase = createServiceClient();

  try {
    // ========================================================================
    // CRITICAL: WEBHOOK SIGNATURE VERIFICATION
    // ========================================================================

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      console.error('Missing stripe-signature header');
      return errorResponse('Missing webhook signature', 400);
    }

    const body = await req.text();
    const webhookSecret = getWebhookSecret();

    let event: WebhookEvent;

    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret
      ) as unknown as WebhookEvent;
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return errorResponse('Invalid webhook signature', 400);
    }

    console.log(`Processing webhook: ${event.type} (${event.id})`);

    // ========================================================================
    // IDEMPOTENCY CHECK
    // ========================================================================

    const { data: existing } = await supabase
      .from('webhook_events')
      .select('id, processed')
      .eq('stripe_event_id', event.id)
      .single();

    if (existing?.processed) {
      console.log(`Event ${event.id} already processed, skipping`);
      return jsonResponse({ received: true, skipped: true });
    }

    // Store event (or update if exists but not processed)
    await supabase.from('webhook_events').upsert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event,
      processed: false,
    });

    // ========================================================================
    // EVENT PROCESSING
    // ========================================================================

    try {
      await processWebhookEvent(supabase, stripe, event);

      // Mark as processed
      await supabase
        .from('webhook_events')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq('stripe_event_id', event.id);

      console.log(`Successfully processed: ${event.type}`);
      return jsonResponse({ received: true });

    } catch (processingError) {
      console.error(`Error processing ${event.type}:`, processingError);

      // Log error to database
      await supabase
        .from('webhook_events')
        .update({
          error: processingError instanceof Error ? processingError.message : 'Unknown error',
        })
        .eq('stripe_event_id', event.id);

      // Return 500 so Stripe retries (idempotency check prevents duplicate processing)
      return serverErrorResponse('Event processing failed');
    }

  } catch (error) {
    console.error('Webhook handler error:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : 'Webhook processing failed'
    );
  }
});

// ============================================================================
// EVENT PROCESSOR
// ============================================================================

async function processWebhookEvent(
  supabase: ReturnType<typeof createServiceClient>,
  stripe: ReturnType<typeof getStripeClient>,
  event: WebhookEvent
): Promise<void> {
  const { type, data } = event;
  const object = data.object;

  switch (type) {
    // Checkout events
    case 'checkout.session.completed':
      await handleCheckoutComplete(supabase, object);
      await handleCommunityCheckoutComplete(supabase, stripe, object);
      await handleStudentPlusCheckoutComplete(supabase, object);
      break;

    // Invoice events
    case 'invoice.paid':
      await handleInvoicePaid(supabase, object);
      break;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(supabase, object);
      break;

    // Subscription events
    case 'customer.subscription.created':
      await handleSubscriptionCreated(supabase, object);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(supabase, object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(supabase, object);
      break;

    // Payment intent events (analytics only)
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(supabase, object);
      break;

    // Connect account events
    case 'account.updated':
      await handleConnectAccountUpdated(supabase, object);
      break;

    default:
      console.log(`Unhandled event type: ${type}`);
  }
}

// ============================================================================
// CHECKOUT HANDLERS
// ============================================================================

async function handleCheckoutComplete(
  supabase: ReturnType<typeof createServiceClient>,
  session: Record<string, unknown>
): Promise<void> {
  const metadata = session.metadata as Record<string, string> | undefined;
  const creatorId = metadata?.creator_id;

  if (!creatorId) {
    console.log('No creator_id in checkout session metadata');
    return;
  }

  if (metadata?.type === 'activation_fee') {
    console.log(`Processing activation fee for creator: ${creatorId}`);

    await supabase
      .from('creator_billing')
      .update({
        activation_fee_paid: true,
        activation_fee_paid_at: new Date().toISOString(),
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('creator_id', creatorId);

    const stripeConfig = getStripeConfig();
    await supabase.from('billing_transactions').insert({
      creator_id: creatorId,
      type: 'activation_fee',
      status: 'completed',
      amount_cents: stripeConfig.activation.amount,
      currency: 'EUR',
      description: 'Account activation fee',
      stripe_payment_intent_id: session.payment_intent as string,
      processed_at: new Date().toISOString(),
    });
  }

  if (metadata?.type === 'plan_subscription') {
    // Plan subscription started via checkout
    console.log(`Processing plan subscription checkout for creator: ${creatorId}`);

    const subscriptionId = session.subscription as string;
    if (subscriptionId) {
      await supabase
        .from('creator_billing')
        .update({
          stripe_subscription_id: subscriptionId,
          monthly_fee_active: true,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('creator_id', creatorId);
    }
  }
}

// ============================================================================
// STUDENT PLUS CHECKOUT HANDLER
// ============================================================================

async function handleStudentPlusCheckoutComplete(
  supabase: ReturnType<typeof createServiceClient>,
  session: Record<string, unknown>
): Promise<void> {
  const metadata = session.metadata as Record<string, string> | undefined;

  if (metadata?.type !== 'student_plus_subscription') {
    return;
  }

  const userId = metadata.user_id;
  if (!userId) {
    console.log('No user_id in Student Plus checkout metadata');
    return;
  }

  const subscriptionId = session.subscription as string;
  if (!subscriptionId) {
    console.log('No subscription ID in Student Plus checkout session');
    return;
  }

  console.log(`Processing Student Plus checkout for user: ${userId}`);

  const { error } = await supabase
    .from('student_subscriptions')
    .update({
      stripe_subscription_id: subscriptionId,
      status: 'active',
      subscribed_since: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to update student subscription:', error);
  } else {
    console.log(`Student Plus activated for user ${userId}`);
  }
}

// ============================================================================
// INVOICE HANDLERS
// ============================================================================

async function handleInvoicePaid(
  supabase: ReturnType<typeof createServiceClient>,
  invoice: Record<string, unknown>
): Promise<void> {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  const amountPaid = (invoice.amount_paid as number) || 0;
  const currency = ((invoice.currency as string) || 'eur').toUpperCase();

  // 1. Check if this is a CREATOR plan subscription
  const { data: billing } = await supabase
    .from('creator_billing')
    .select('creator_id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (billing) {
    await supabase.from('billing_transactions').insert({
      creator_id: billing.creator_id,
      type: 'subscription',
      status: 'completed',
      amount_cents: amountPaid,
      currency: currency,
      description: 'Monthly subscription payment',
      stripe_invoice_id: invoice.id as string,
      related_subscription_id: subscriptionId,
      processed_at: new Date().toISOString(),
    });
    return;
  }

  // 2. Check if it's a COMMUNITY subscription renewal
  const { data: membership } = await supabase
    .from('memberships')
    .select(`
      id,
      user_id,
      community_id,
      community:communities(name, creator_id, price_cents)
    `)
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (membership && membership.community) {
    const community = membership.community as { name: string; creator_id: string; price_cents: number };
    const creatorId = community.creator_id;

    console.log(`Processing community renewal for creator ${creatorId}, community: ${community.name}`);

    // Record renewal sale for analytics
    await supabase
      .from('creator_sales')
      .insert({
        creator_id: creatorId,
        buyer_id: membership.user_id,
        product_type: 'membership_renewal',
        product_id: membership.community_id,
        product_name: `${community.name} (renewal)`,
        sale_amount_cents: amountPaid,
        platform_fee_cents: 0, // Stripe Connect handles fees via application_fee_amount
        stripe_fee_cents: 0,
        net_amount_cents: amountPaid,
        currency: currency,
        stripe_payment_intent_id: null,
        stripe_invoice_id: invoice.id as string,
        status: 'completed',
        completed_at: new Date().toISOString(),
      });

    console.log(`Renewal recorded: ${amountPaid} cents for creator ${creatorId}`);
    return;
  }

  console.log(`Unknown subscription in invoice.paid: ${subscriptionId}`);
}

async function handleInvoicePaymentFailed(
  supabase: ReturnType<typeof createServiceClient>,
  invoice: Record<string, unknown>
): Promise<void> {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  // Update creator billing status to past_due
  await supabase
    .from('creator_billing')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);

  // Also check if this is a community subscription
  await supabase
    .from('memberships')
    .update({
      payment_status: 'expired',
    })
    .eq('stripe_subscription_id', subscriptionId);
}

// ============================================================================
// SUBSCRIPTION HANDLERS
// ============================================================================

async function handleSubscriptionCreated(
  supabase: ReturnType<typeof createServiceClient>,
  subscription: Record<string, unknown>
): Promise<void> {
  const metadata = subscription.metadata as Record<string, string> | undefined;
  const subscriptionId = subscription.id as string;

  // 1. Student Plus subscriptions
  if (metadata?.subscription_type === 'student_plus' && metadata?.user_id) {
    console.log(`Student Plus subscription created for user: ${metadata.user_id}`);
    await supabase
      .from('student_subscriptions')
      .update({
        stripe_subscription_id: subscriptionId,
        status: subscription.status as string,
        current_period_start: new Date((subscription.current_period_start as number) * 1000).toISOString(),
        current_period_end: new Date((subscription.current_period_end as number) * 1000).toISOString(),
        subscribed_since: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', metadata.user_id);
    return;
  }

  // 2. Skip community subscriptions — they don't affect creator_billing
  if (metadata?.type === 'community_subscription' || metadata?.community_id) {
    console.log('Skipping community subscription - not a creator plan');
    return;
  }

  // 3. Creator plan subscriptions
  const creatorId = metadata?.creator_id;
  if (!creatorId) {
    console.log('No creator_id in subscription metadata - not a creator plan');
    return;
  }

  await supabase
    .from('creator_billing')
    .update({
      stripe_subscription_id: subscriptionId,
      status: subscription.status as string,
      monthly_fee_active: true,
      current_period_start: new Date((subscription.current_period_start as number) * 1000).toISOString(),
      current_period_end: new Date((subscription.current_period_end as number) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('creator_id', creatorId);
}

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createServiceClient>,
  subscription: Record<string, unknown>
): Promise<void> {
  const subscriptionId = subscription.id as string;
  const metadata = subscription.metadata as Record<string, string> | undefined;

  // 1. Student Plus subscription
  if (metadata?.subscription_type === 'student_plus') {
    console.log(`Updating Student Plus subscription: ${subscriptionId}`);
    await supabase
      .from('student_subscriptions')
      .update({
        status: subscription.status as string,
        current_period_start: new Date((subscription.current_period_start as number) * 1000).toISOString(),
        current_period_end: new Date((subscription.current_period_end as number) * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end as boolean || false,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscriptionId);
    return;
  }

  // 2. Community subscription
  if (metadata?.community_id || metadata?.membership_id) {
    await handleCommunitySubscriptionUpdated(supabase, subscription);
    return;
  }

  // 3. Creator plan subscription
  await supabase
    .from('creator_billing')
    .update({
      status: subscription.status as string,
      current_period_start: new Date((subscription.current_period_start as number) * 1000).toISOString(),
      current_period_end: new Date((subscription.current_period_end as number) * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end as boolean,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);
}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createServiceClient>,
  subscription: Record<string, unknown>
): Promise<void> {
  const subscriptionId = subscription.id as string;
  const metadata = subscription.metadata as Record<string, string> | undefined;

  // 1. Student Plus subscription
  if (metadata?.subscription_type === 'student_plus') {
    console.log(`Student Plus subscription canceled: ${subscriptionId}`);
    await supabase
      .from('student_subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscriptionId);
    return;
  }

  // 2. Community subscription
  if (metadata?.community_id || metadata?.membership_id) {
    await handleCommunitySubscriptionDeleted(supabase, subscription);
    return;
  }

  // 3. Creator plan subscription — downgrade to Starter
  const { data: starterPlan } = await supabase
    .from('billing_plans')
    .select('id')
    .eq('tier', 'starter')
    .single();

  await supabase
    .from('creator_billing')
    .update({
      status: 'canceled',
      monthly_fee_active: false,
      stripe_subscription_id: null,
      plan_id: starterPlan?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);
}

// ============================================================================
// PAYMENT INTENT HANDLER (analytics only)
// ============================================================================

async function handlePaymentIntentSucceeded(
  supabase: ReturnType<typeof createServiceClient>,
  paymentIntent: Record<string, unknown>
): Promise<void> {
  const metadata = paymentIntent.metadata as Record<string, string> | undefined;

  if (!metadata?.product_type || !metadata?.creator_id) {
    return;
  }

  const creatorId = metadata.creator_id;
  const buyerId = metadata.buyer_id;
  const productId = metadata.product_id;
  const productType = metadata.product_type;

  console.log(`Processing sale for creator: ${creatorId}, product: ${productType}`);

  // Record the sale for analytics display
  await supabase.from('creator_sales').insert({
    creator_id: creatorId,
    buyer_id: buyerId ?? null,
    product_type: productType,
    product_id: productId ?? null,
    product_name: metadata.product_name || 'Unknown Product',
    sale_amount_cents: paymentIntent.amount as number,
    platform_fee_cents: (paymentIntent.application_fee_amount as number) ?? 0,
    stripe_fee_cents: 0,
    net_amount_cents: (paymentIntent.amount as number) -
      ((paymentIntent.application_fee_amount as number) ?? 0),
    currency: ((paymentIntent.currency as string) || 'eur').toUpperCase(),
    stripe_payment_intent_id: paymentIntent.id as string,
    status: 'completed',
    completed_at: new Date().toISOString(),
  });

  // Create enrollment for course purchases
  if (productType === 'course' && productId && buyerId) {
    console.log(`Creating enrollment for buyer ${buyerId} in course ${productId}`);

    const { data: existingEnrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', buyerId)
      .eq('course_id', productId)
      .single();

    if (!existingEnrollment) {
      const { error: enrollmentError } = await supabase
        .from('enrollments')
        .insert({
          user_id: buyerId,
          course_id: productId,
          enrolled_at: new Date().toISOString(),
          status: 'active',
        });

      if (enrollmentError) {
        console.error(`Failed to create enrollment: ${enrollmentError.message}`);
      } else {
        console.log('Enrollment created successfully');
      }
    } else {
      console.log(`Enrollment already exists for buyer ${buyerId} in course ${productId}`);
    }
  }
}

// ============================================================================
// CONNECT ACCOUNT HANDLER
// ============================================================================

async function handleConnectAccountUpdated(
  supabase: ReturnType<typeof createServiceClient>,
  account: Record<string, unknown>
): Promise<void> {
  const accountId = account.id as string;

  const status = (account.payouts_enabled && account.charges_enabled)
    ? 'active'
    : account.details_submitted
      ? 'restricted'
      : 'pending';

  await supabase
    .from('creator_billing')
    .update({
      stripe_account_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_account_id', accountId);
}

// ============================================================================
// COMMUNITY ACCESS HANDLERS
// ============================================================================

async function handleCommunityCheckoutComplete(
  supabase: ReturnType<typeof createServiceClient>,
  stripe: ReturnType<typeof getStripeClient>,
  session: Record<string, unknown>
): Promise<void> {
  const metadata = session.metadata as Record<string, string> | undefined;

  if (metadata?.type !== 'community_purchase') {
    return;
  }

  const membershipId = metadata.membership_id;
  const communityId = metadata.community_id;
  const buyerId = metadata.buyer_id;
  const creatorId = metadata.creator_id;

  // Discount tracking info from metadata
  const discountCodeId = metadata.discount_code_id || null;
  const discountCode = metadata.discount_code || null;
  const originalAmountCents = parseInt(metadata.original_amount_cents || '0', 10);
  const discountAmountCents = parseInt(metadata.discount_amount_cents || '0', 10);

  if (!membershipId || !communityId) {
    console.log('Missing membership_id or community_id in community checkout metadata');
    return;
  }

  console.log(`Processing community checkout for membership: ${membershipId}`);

  // 1. Update membership to paid
  const updateData: Record<string, unknown> = {
    payment_status: 'paid',
    paid_at: new Date().toISOString(),
  };

  if (session.customer) {
    updateData.stripe_customer_id = session.customer;
  }

  // Handle subscription (monthly) vs one-time payment
  if (session.subscription) {
    updateData.stripe_subscription_id = session.subscription;
    try {
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      updateData.expires_at = new Date(subscription.current_period_end * 1000).toISOString();
    } catch (err) {
      console.error('Error fetching subscription details:', err);
    }
  }

  if (session.payment_intent) {
    updateData.stripe_payment_intent_id = session.payment_intent;
  }

  await supabase
    .from('memberships')
    .update(updateData)
    .eq('id', membershipId);

  // 2. Update or create purchase record
  const { data: existingPurchase } = await supabase
    .from('community_purchases')
    .select('id')
    .eq('stripe_checkout_session_id', session.id)
    .maybeSingle();

  if (existingPurchase) {
    await supabase
      .from('community_purchases')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        stripe_payment_intent_id: session.payment_intent as string || null,
        stripe_subscription_id: session.subscription as string || null,
      })
      .eq('id', existingPurchase.id);
  } else {
    await supabase
      .from('community_purchases')
      .insert({
        community_id: communityId,
        buyer_id: buyerId || null,
        creator_id: creatorId || null,
        membership_id: membershipId || null,
        purchase_type: session.mode === 'subscription' ? 'monthly' : 'one_time',
        amount_cents: session.amount_total || 0,
        currency: (session.currency || 'eur').toLowerCase(),
        platform_fee_cents: 0,
        stripe_fee_cents: 0,
        creator_payout_cents: 0,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent as string || null,
        stripe_subscription_id: session.subscription as string || null,
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
  }

  // 3. Record sale for analytics
  const { data: community } = await supabase
    .from('communities')
    .select('name, price_cents, monthly_price_cents')
    .eq('id', communityId)
    .single();

  if (community && creatorId) {
    const actualAmountCents = (session.amount_total as number) || community.price_cents;

    // Check for existing sale to prevent duplicates on webhook retries
    const { data: existingSale } = await supabase
      .from('creator_sales')
      .select('id')
      .eq('creator_id', creatorId)
      .eq('buyer_id', buyerId || '')
      .eq('product_id', communityId)
      .eq('status', 'completed')
      .maybeSingle();

    if (existingSale) {
      console.log(`Sale already recorded for community ${communityId}, buyer ${buyerId}, skipping duplicate`);
    } else {
      await supabase
        .from('creator_sales')
        .insert({
          creator_id: creatorId,
          buyer_id: buyerId || null,
          product_type: 'membership',
          product_id: communityId,
          product_name: community.name,
          sale_amount_cents: actualAmountCents,
          platform_fee_cents: 0, // Stripe Connect handles fees via application_fee_amount
          stripe_fee_cents: 0,
          net_amount_cents: actualAmountCents,
          currency: (session.currency as string || 'eur').toLowerCase(),
          stripe_payment_intent_id: session.payment_intent as string || null,
          status: 'completed',
          completed_at: new Date().toISOString(),
        });

      console.log(`Sale recorded: ${actualAmountCents} cents for creator ${creatorId}`);
    }
  }

  // 4. Record discount redemption if a discount code was used
  if (discountCodeId && buyerId) {
    try {
      const finalAmountCents = (session.amount_total as number) || (originalAmountCents - discountAmountCents);

      await supabase.from('discount_redemptions').insert({
        discount_code_id: discountCodeId,
        student_id: buyerId,
        community_id: communityId,
        original_amount_cents: originalAmountCents,
        discount_amount_cents: discountAmountCents,
        final_amount_cents: finalAmountCents,
        stripe_checkout_session_id: session.id as string,
      });

      await supabase.rpc('increment_discount_usage', { code_id: discountCodeId });

      console.log(`Discount code ${discountCode} redeemed for community ${communityId} by ${buyerId}`);
    } catch (discountError) {
      // Log but don't fail the checkout
      console.error('Error recording discount redemption:', discountError);
    }
  }

  console.log(`Community checkout completed: membership ${membershipId} now has paid access`);
}

async function handleCommunitySubscriptionUpdated(
  supabase: ReturnType<typeof createServiceClient>,
  subscription: Record<string, unknown>
): Promise<void> {
  const metadata = subscription.metadata as Record<string, string> | undefined;
  const membershipId = metadata?.membership_id;

  if (!membershipId) {
    const { data: membership } = await supabase
      .from('memberships')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (!membership) {
      console.log('No membership found for community subscription:', subscription.id);
      return;
    }
  }

  const status = subscription.status as string;
  const expiresAt = new Date((subscription.current_period_end as number) * 1000).toISOString();

  // Map Stripe status to our payment_status
  let paymentStatus = 'paid';
  if (status === 'past_due' || status === 'unpaid') {
    paymentStatus = 'expired';
  } else if (status === 'canceled') {
    paymentStatus = 'canceled';
  } else if (status !== 'active' && status !== 'trialing') {
    paymentStatus = 'failed';
  }

  await supabase
    .from('memberships')
    .update({
      payment_status: paymentStatus,
      expires_at: expiresAt,
    })
    .eq('stripe_subscription_id', subscription.id);
}

async function handleCommunitySubscriptionDeleted(
  supabase: ReturnType<typeof createServiceClient>,
  subscription: Record<string, unknown>
): Promise<void> {
  const subscriptionId = subscription.id as string;

  await supabase
    .from('memberships')
    .update({
      payment_status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);

  console.log(`Community subscription canceled: ${subscriptionId}`);
}
