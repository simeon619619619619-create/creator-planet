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
// Handled Events:
// - checkout.session.completed
// - invoice.paid / invoice.payment_failed
// - customer.subscription.created/updated/deleted
// - payment_intent.succeeded/payment_failed
// - account.updated (Connect)
// - payout.paid/failed (Connect)
// - charge.dispute.created (Chargeback - new balance system)
// - charge.dispute.closed (Chargeback resolution - new balance system)
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
    // This prevents attackers from sending fake webhook events
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
      // Verify the webhook signature
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
    // Prevent duplicate processing of the same event
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
      await processWebhookEvent(supabase, event);

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

      // Return 200 to acknowledge receipt (Stripe will retry on 5xx)
      // We log the error for manual investigation
      return jsonResponse({ received: true, error: 'Processing failed' });
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
// Routes events to appropriate handlers
// ============================================================================

async function processWebhookEvent(
  supabase: ReturnType<typeof createServiceClient>,
  event: WebhookEvent
): Promise<void> {
  const { type, data } = event;
  const object = data.object;

  switch (type) {
    // Checkout events
    case 'checkout.session.completed':
      await handleCheckoutComplete(supabase, object);
      // Also handle community checkout
      await handleCommunityCheckoutComplete(supabase, object);
      // Also handle Student Plus checkout
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

    // Payment intent events
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(supabase, object);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(supabase, object);
      break;

    // Connect account events
    case 'account.updated':
      await handleConnectAccountUpdated(supabase, object);
      break;

    // Payout events
    case 'payout.paid':
      await handlePayoutPaid(supabase, object);
      break;
    case 'payout.failed':
      await handlePayoutFailed(supabase, object);
      break;

    // Chargeback/Dispute events (Balance System)
    case 'charge.dispute.created':
      await handleDisputeCreated(supabase, object);
      break;
    case 'charge.dispute.closed':
      await handleDisputeClosed(supabase, object);
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
    // Activation fee paid
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

    // Record transaction (uses mode-aware config)
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
}

// ============================================================================
// STUDENT PLUS CHECKOUT HANDLER
// ============================================================================

async function handleStudentPlusCheckoutComplete(
  supabase: ReturnType<typeof createServiceClient>,
  session: Record<string, unknown>
): Promise<void> {
  const metadata = session.metadata as Record<string, string> | undefined;

  // Only process student_plus_subscription type checkouts
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

  // Update student_subscriptions with the subscription ID
  // The record should already exist from student-plus-checkout, just update status
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

  // First, check if this is a CREATOR plan subscription
  const { data: billing } = await supabase
    .from('creator_billing')
    .select('creator_id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (billing) {
    // This is a creator plan renewal - record as billing transaction
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

  // Not a creator plan - check if it's a COMMUNITY subscription renewal
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

    // Get creator's plan for fee calculation
    const { data: creatorBilling } = await supabase
      .from('creator_billing')
      .select(`
        total_earned_cents,
        plan:billing_plans(platform_fee_percent)
      `)
      .eq('creator_id', creatorId)
      .single();

    const feePercent = (creatorBilling?.plan as { platform_fee_percent?: number })?.platform_fee_percent ?? 6.9;
    const platformFee = Math.round(amountPaid * (feePercent / 100));
    const stripeFee = Math.round(amountPaid * 0.029 + 25); // ~2.9% + €0.25
    const netAmount = amountPaid - platformFee - stripeFee;

    // Record renewal sale
    const { data: saleRecord } = await supabase
      .from('creator_sales')
      .insert({
        creator_id: creatorId,
        buyer_id: membership.user_id,
        product_type: 'membership_renewal',
        product_id: membership.community_id,
        product_name: `${community.name} (renewal)`,
        sale_amount_cents: amountPaid,
        platform_fee_cents: platformFee,
        stripe_fee_cents: stripeFee,
        net_amount_cents: netAmount,
        currency: currency,
        stripe_payment_intent_id: null,
        stripe_invoice_id: invoice.id as string,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    // Update lifetime earnings
    const currentEarned = creatorBilling?.total_earned_cents || 0;
    await supabase
      .from('creator_billing')
      .update({
        total_earned_cents: currentEarned + netAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('creator_id', creatorId);

    // Audit trail
    await supabase.from('balance_transactions').insert({
      creator_id: creatorId,
      type: 'sale',
      amount_cents: netAmount,
      pending_after_cents: 0,
      available_after_cents: 0,
      reserved_after_cents: 0,
      negative_after_cents: 0,
      reference_type: 'creator_sales',
      reference_id: saleRecord?.id || null,
      stripe_id: invoice.id as string,
      description: `Community renewal: ${community.name}`,
      metadata: {
        product_type: 'membership_renewal',
        product_id: membership.community_id,
        gross_amount_cents: amountPaid,
        platform_fee_cents: platformFee,
        stripe_fee_cents: stripeFee,
        funds_model: 'destination_charge',
      },
    });

    console.log(`Renewal recorded: ${netAmount} cents net for creator ${creatorId}`);
    return;
  }

  // Unknown subscription - log for debugging
  console.log(`Unknown subscription in invoice.paid: ${subscriptionId}`);
}

async function handleInvoicePaymentFailed(
  supabase: ReturnType<typeof createServiceClient>,
  invoice: Record<string, unknown>
): Promise<void> {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  // Update billing status to past_due
  await supabase
    .from('creator_billing')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
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

  // 1. Check for Student Plus subscriptions
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

  // 2. Skip community subscriptions - they have community_id in metadata
  // and should NOT update creator_billing
  if (metadata?.type === 'community_subscription' || metadata?.community_id) {
    console.log('Skipping community subscription - not a creator plan');
    return;
  }

  // 3. Handle creator plan subscriptions (requires creator_id)
  const creatorId = metadata?.creator_id;
  if (!creatorId) {
    console.log('No creator_id in subscription metadata - not a creator plan');
    return;
  }

  // Only update creator_billing for actual creator plan subscriptions
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

  // 1. Check if this is a Student Plus subscription
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

  // 2. Check if this is a community subscription
  if (metadata?.community_id && metadata?.membership_id) {
    await handleCommunitySubscriptionUpdated(supabase, subscription);
    return;
  }

  // 3. Otherwise it's a creator plan subscription
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

  // 1. Check if this is a Student Plus subscription
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

  // 2. Check if this is a community subscription
  if (metadata?.community_id || metadata?.membership_id) {
    await handleCommunitySubscriptionDeleted(supabase, subscription);
    return;
  }

  // 3. Otherwise it's a creator plan subscription - downgrade to Starter
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
      plan_id: starterPlan?.id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);
}

// ============================================================================
// PAYMENT INTENT HANDLERS
// ============================================================================

async function handlePaymentIntentSucceeded(
  supabase: ReturnType<typeof createServiceClient>,
  paymentIntent: Record<string, unknown>
): Promise<void> {
  const metadata = paymentIntent.metadata as Record<string, string> | undefined;

  // Check if this is a product sale (not activation or subscription)
  if (metadata?.product_type && metadata?.creator_id) {
    const creatorId = metadata.creator_id;
    const buyerId = metadata.buyer_id;
    const productId = metadata.product_id;
    const productType = metadata.product_type;

    console.log(`Processing sale for creator: ${creatorId}, product: ${productType}`);

    // Record the sale
    await supabase.from('creator_sales').insert({
      creator_id: creatorId,
      buyer_id: buyerId || null,
      product_type: productType,
      product_id: productId || null,
      product_name: metadata.product_name || 'Unknown Product',
      sale_amount_cents: paymentIntent.amount as number,
      platform_fee_cents: parseInt(metadata.platform_fee_cents || '0', 10) ||
        (paymentIntent.application_fee_amount as number) || 0,
      stripe_fee_cents: 0, // Will be updated by Stripe
      net_amount_cents: (paymentIntent.amount as number) -
        (parseInt(metadata.platform_fee_cents || '0', 10) ||
        (paymentIntent.application_fee_amount as number) || 0),
      currency: ((paymentIntent.currency as string) || 'eur').toUpperCase(),
      stripe_payment_intent_id: paymentIntent.id as string,
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    // CRITICAL: Create enrollment for course purchases
    // This grants the buyer access to the course they paid for
    if (productType === 'course' && productId && buyerId) {
      console.log(`Creating enrollment for buyer ${buyerId} in course ${productId}`);

      // Check if enrollment already exists (idempotency)
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
          console.log(`Enrollment created successfully`);
        }
      } else {
        console.log(`Enrollment already exists for buyer ${buyerId} in course ${productId}`);
      }
    }

    // Check and trigger first sale logic
    await handleFirstSale(supabase, creatorId);
  }
}

async function handlePaymentIntentFailed(
  supabase: ReturnType<typeof createServiceClient>,
  paymentIntent: Record<string, unknown>
): Promise<void> {
  const metadata = paymentIntent.metadata as Record<string, string> | undefined;
  if (!metadata?.creator_id) return;

  const lastError = paymentIntent.last_payment_error as Record<string, unknown> | undefined;

  await supabase.from('billing_transactions').insert({
    creator_id: metadata.creator_id,
    type: 'platform_fee',
    status: 'failed',
    amount_cents: paymentIntent.amount as number,
    currency: ((paymentIntent.currency as string) || 'eur').toUpperCase(),
    description: 'Payment failed',
    stripe_payment_intent_id: paymentIntent.id as string,
    metadata: { error: lastError?.message || 'Unknown error' },
  });
}

// ============================================================================
// CONNECT ACCOUNT HANDLERS
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
// PAYOUT HANDLERS
// ============================================================================

async function handlePayoutPaid(
  supabase: ReturnType<typeof createServiceClient>,
  payout: Record<string, unknown>
): Promise<void> {
  // The destination in payout events is the bank account, not the Connect account
  // We need to use the account from the event context (available in full webhook)
  // For now, we'll match by searching for recent pending payouts

  const accountId = payout.destination as string;

  const { data: billing } = await supabase
    .from('creator_billing')
    .select('creator_id')
    .eq('stripe_account_id', accountId)
    .single();

  if (billing) {
    await supabase.from('billing_transactions').insert({
      creator_id: billing.creator_id,
      type: 'payout',
      status: 'completed',
      amount_cents: payout.amount as number,
      currency: ((payout.currency as string) || 'eur').toUpperCase(),
      description: 'Payout to bank account',
      stripe_transfer_id: payout.id as string,
      processed_at: new Date().toISOString(),
    });
  }
}

async function handlePayoutFailed(
  supabase: ReturnType<typeof createServiceClient>,
  payout: Record<string, unknown>
): Promise<void> {
  const accountId = payout.destination as string;

  const { data: billing } = await supabase
    .from('creator_billing')
    .select('creator_id')
    .eq('stripe_account_id', accountId)
    .single();

  if (billing) {
    await supabase.from('billing_transactions').insert({
      creator_id: billing.creator_id,
      type: 'payout',
      status: 'failed',
      amount_cents: payout.amount as number,
      currency: ((payout.currency as string) || 'eur').toUpperCase(),
      description: 'Payout failed',
      stripe_transfer_id: payout.id as string,
      metadata: { failure_code: payout.failure_code },
    });
  }
}

// ============================================================================
// FIRST SALE HANDLER
// Triggers monthly fee activation for Pro/Scale creators
// ============================================================================

async function handleFirstSale(
  supabase: ReturnType<typeof createServiceClient>,
  creatorId: string
): Promise<void> {
  // Get billing record
  const { data: billing } = await supabase
    .from('creator_billing')
    .select(`
      *,
      plan:billing_plans(tier)
    `)
    .eq('creator_id', creatorId)
    .single();

  if (!billing || billing.has_first_sale) {
    return; // Already handled or no billing record
  }

  // Update first sale flag
  await supabase
    .from('creator_billing')
    .update({
      has_first_sale: true,
      first_sale_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('creator_id', creatorId);

  console.log(`First sale recorded for creator: ${creatorId}, plan: ${billing.plan?.tier}`);

  // Note: Monthly fee activation for Pro/Scale will be handled client-side
  // when the creator next visits their dashboard - they'll be prompted to
  // complete subscription checkout
}

// ============================================================================
// COMMUNITY ACCESS HANDLERS
// Handles paid community checkout and subscription events
// ============================================================================

async function handleCommunityCheckoutComplete(
  supabase: ReturnType<typeof createServiceClient>,
  session: Record<string, unknown>
): Promise<void> {
  const metadata = session.metadata as Record<string, string> | undefined;

  // Only process community_purchase type checkouts
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

  // Save stripe_customer_id for billing portal access (cancel subscription)
  if (session.customer) {
    updateData.stripe_customer_id = session.customer;
  }

  // Handle subscription (monthly) vs one-time payment
  if (session.subscription) {
    updateData.stripe_subscription_id = session.subscription;
    // For subscriptions, set expiry to current period end
    // This will be updated on each renewal
    const stripe = getStripeClient();
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

  // 2. Update or create purchase record (pending record may not exist if checkout insert failed)
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
    // Create the record if it doesn't exist (fallback for failed pending inserts)
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

  // 3. Get community info for creator_sales record
  const { data: community } = await supabase
    .from('communities')
    .select('name, price_cents, monthly_price_cents')
    .eq('id', communityId)
    .single();

  if (community && creatorId) {
    // Use actual amount charged by Stripe (handles discounts, monthly pricing, etc.)
    const actualAmountCents = (session.amount_total as number) || community.price_cents;

    // Get creator's plan for platform fee calculation
    const { data: creatorBilling } = await supabase
      .from('creator_billing')
      .select(`
        *,
        plan:billing_plans(platform_fee_percent)
      `)
      .eq('creator_id', creatorId)
      .single();

    const feePercent = (creatorBilling?.plan as { platform_fee_percent?: number })?.platform_fee_percent ?? 6.9;
    const platformFee = Math.round(actualAmountCents * (feePercent / 100));
    const stripeFee = Math.round(actualAmountCents * 0.029 + 25); // Estimated ~2.9% + EUR 0.25
    const netAmount = Math.max(0, actualAmountCents - platformFee - stripeFee);

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
      // Record in creator_sales
      const { data: saleRecord } = await supabase
        .from('creator_sales')
        .insert({
          creator_id: creatorId,
          buyer_id: buyerId || null,
          product_type: 'membership',
          product_id: communityId,
          product_name: community.name,
          sale_amount_cents: actualAmountCents,
          platform_fee_cents: platformFee,
          stripe_fee_cents: stripeFee,
          net_amount_cents: actualAmountCents - platformFee,
          currency: (session.currency as string || 'eur').toLowerCase(),
          stripe_payment_intent_id: session.payment_intent as string || null,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      // Update creator balance for reporting
      const currentAvailable = creatorBilling?.available_balance_cents || 0;
      const newAvailableBalance = currentAvailable + netAmount;

      await supabase
        .from('creator_billing')
        .update({
          available_balance_cents: newAvailableBalance,
          updated_at: new Date().toISOString(),
        })
        .eq('creator_id', creatorId);

      // Create audit trail record
      await supabase
        .from('balance_transactions')
        .insert({
          creator_id: creatorId,
          type: 'sale',
          amount_cents: netAmount,
          pending_after_cents: creatorBilling?.pending_balance_cents || 0,
          available_after_cents: newAvailableBalance,
          reserved_after_cents: creatorBilling?.reserved_balance_cents || 0,
          negative_after_cents: creatorBilling?.negative_balance_cents || 0,
          reference_type: 'creator_sales',
          reference_id: saleRecord?.id || null,
          stripe_id: session.payment_intent as string || null,
          description: `Community membership: ${community.name}`,
          metadata: {
            product_type: 'membership',
            product_id: communityId,
            actual_amount_cents: actualAmountCents,
            platform_fee_cents: platformFee,
            stripe_fee_cents: stripeFee,
            funds_model: 'destination_charge',
          },
        });

      console.log(`Sale recorded: ${actualAmountCents} cents gross, ${netAmount} cents net for creator ${creatorId} (balance: ${newAvailableBalance})`);
    }

    // 5. Trigger first sale logic for creator
    await handleFirstSale(supabase, creatorId);
  }

  // 5. Record discount redemption if a discount code was used
  if (discountCodeId && buyerId) {
    try {
      // Get final amount from Stripe session
      const finalAmountCents = (session.amount_total as number) || (originalAmountCents - discountAmountCents);

      // Record the redemption
      await supabase.from('discount_redemptions').insert({
        discount_code_id: discountCodeId,
        student_id: buyerId,
        community_id: communityId,
        original_amount_cents: originalAmountCents,
        discount_amount_cents: discountAmountCents,
        final_amount_cents: finalAmountCents,
        stripe_checkout_session_id: session.id as string,
      });

      // Increment usage count on the discount code
      await supabase.rpc('increment_discount_usage', { code_id: discountCodeId });

      console.log(`Discount code ${discountCode} redeemed for community ${communityId} by ${buyerId}`);
    } catch (discountError) {
      // Log but don't fail the checkout - redemption tracking is secondary
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
    // Try to find membership by subscription ID
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

// ============================================================================
// CHARGEBACK/DISPUTE HANDLERS (Balance System)
// ============================================================================

/**
 * Handle a new dispute (chargeback) being created
 * Deducts from creator's available balance (or creates negative balance)
 */
async function handleDisputeCreated(
  supabase: ReturnType<typeof createServiceClient>,
  dispute: Record<string, unknown>
): Promise<void> {
  const disputeId = dispute.id as string;
  const chargeId = dispute.charge as string;
  const disputeAmount = dispute.amount as number; // Amount in cents

  console.log(`Processing chargeback dispute: ${disputeId} for charge ${chargeId}, amount: ${disputeAmount}`);

  // Find the creator from the original charge via creator_sales
  // Note: chargeId from dispute.charge is the Stripe charge ID
  // We search by stripe_payment_intent_id (charges come from payment intents)
  // and stripe_charge_id (if we stored it separately)
  const { data: sale } = await supabase
    .from('creator_sales')
    .select('creator_id, product_name')
    .or(`stripe_payment_intent_id.eq.${chargeId},stripe_charge_id.eq.${chargeId}`)
    .single();

  // Also try to find via pending_balances if not in creator_sales
  let creatorId = sale?.creator_id;
  let productName = sale?.product_name;

  if (!creatorId) {
    const { data: pendingBalance } = await supabase
      .from('pending_balances')
      .select('creator_id, product_name')
      .or(`stripe_payment_id.eq.${chargeId},stripe_checkout_session_id.eq.${chargeId}`)
      .single();

    creatorId = pendingBalance?.creator_id;
    productName = pendingBalance?.product_name;
  }

  if (!creatorId) {
    console.log(`No creator found for disputed charge: ${chargeId}`);
    return;
  }

  // Get current billing state
  const { data: billing } = await supabase
    .from('creator_billing')
    .select('*')
    .eq('creator_id', creatorId)
    .single();

  if (!billing) {
    console.log(`No billing record for creator: ${creatorId}`);
    return;
  }

  // Calculate how much to deduct from each balance type
  let remainingDispute = disputeAmount;
  let deductFromAvailable = 0;
  let deductFromReserve = 0;
  let addToNegative = 0;

  // First, try to use available balance
  if (billing.available_balance_cents > 0) {
    deductFromAvailable = Math.min(billing.available_balance_cents, remainingDispute);
    remainingDispute -= deductFromAvailable;
  }

  // Then, use reserved balance if needed
  if (remainingDispute > 0 && billing.reserved_balance_cents > 0) {
    deductFromReserve = Math.min(billing.reserved_balance_cents, remainingDispute);
    remainingDispute -= deductFromReserve;

    // Mark reserve_releases as 'used' for this dispute
    // Note: This is a simplified approach - in production you might want to
    // match specific reserves to specific sales
    if (deductFromReserve > 0) {
      const { data: reserves } = await supabase
        .from('reserve_releases')
        .select('id, amount_cents')
        .eq('creator_id', creatorId)
        .eq('status', 'held')
        .order('created_at', { ascending: true })
        .limit(10);

      let reserveRemaining = deductFromReserve;
      for (const reserve of reserves || []) {
        if (reserveRemaining <= 0) break;
        const useAmount = Math.min(reserve.amount_cents, reserveRemaining);

        await supabase
          .from('reserve_releases')
          .update({
            status: 'used',
            used_at: new Date().toISOString(),
            used_for_dispute_id: disputeId,
          })
          .eq('id', reserve.id);

        reserveRemaining -= useAmount;
      }
    }
  }

  // Any remaining amount goes to negative balance
  if (remainingDispute > 0) {
    addToNegative = remainingDispute;
  }

  // Calculate new balances
  const newAvailable = billing.available_balance_cents - deductFromAvailable;
  const newReserved = billing.reserved_balance_cents - deductFromReserve;
  const newNegative = billing.negative_balance_cents + addToNegative;

  // Update creator_billing
  await supabase
    .from('creator_billing')
    .update({
      available_balance_cents: newAvailable,
      reserved_balance_cents: newReserved,
      negative_balance_cents: newNegative,
      updated_at: new Date().toISOString(),
    })
    .eq('creator_id', creatorId);

  // Create balance_transaction record
  await supabase
    .from('balance_transactions')
    .insert({
      creator_id: creatorId,
      type: 'chargeback',
      amount_cents: -disputeAmount, // Negative because it's a debit
      pending_after_cents: billing.pending_balance_cents,
      available_after_cents: newAvailable,
      reserved_after_cents: newReserved,
      negative_after_cents: newNegative,
      reference_type: 'dispute',
      reference_id: disputeId,
      stripe_id: disputeId,
      description: `Chargeback dispute for ${productName || 'unknown product'}`,
      metadata: {
        charge_id: chargeId,
        dispute_reason: dispute.reason,
        deducted_from_available: deductFromAvailable,
        deducted_from_reserve: deductFromReserve,
        added_to_negative: addToNegative,
      },
    });

  // Also cancel any pending balance for this charge if it exists and is still pending
  const { data: pendingToCancel } = await supabase
    .from('pending_balances')
    .select('id, net_amount_cents')
    .or(`stripe_payment_id.eq.${chargeId},stripe_checkout_session_id.eq.${chargeId}`)
    .eq('status', 'pending')
    .single();

  if (pendingToCancel) {
    // Cancel the pending balance
    await supabase
      .from('pending_balances')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', pendingToCancel.id);

    // Reduce pending_balance_cents
    await supabase
      .from('creator_billing')
      .update({
        pending_balance_cents: Math.max(0, billing.pending_balance_cents - pendingToCancel.net_amount_cents),
        updated_at: new Date().toISOString(),
      })
      .eq('creator_id', creatorId);
  }

  console.log(`Chargeback processed for creator ${creatorId}: -${disputeAmount} cents (avail: -${deductFromAvailable}, reserve: -${deductFromReserve}, negative: +${addToNegative})`);
}

/**
 * Handle a dispute being closed (won or lost)
 * If won, credit the amount back to creator
 */
async function handleDisputeClosed(
  supabase: ReturnType<typeof createServiceClient>,
  dispute: Record<string, unknown>
): Promise<void> {
  const disputeId = dispute.id as string;
  const disputeStatus = dispute.status as string;
  const disputeAmount = dispute.amount as number;

  console.log(`Dispute closed: ${disputeId}, status: ${disputeStatus}, amount: ${disputeAmount}`);

  // Only process won disputes (creator gets money back)
  if (disputeStatus !== 'won') {
    console.log(`Dispute ${disputeId} was not won (status: ${disputeStatus}), no reversal needed`);
    return;
  }

  // Find the original chargeback transaction
  const { data: originalTx } = await supabase
    .from('balance_transactions')
    .select('creator_id, metadata')
    .eq('type', 'chargeback')
    .eq('stripe_id', disputeId)
    .single();

  if (!originalTx) {
    console.log(`No original chargeback transaction found for dispute: ${disputeId}`);
    return;
  }

  const creatorId = originalTx.creator_id;

  // Get current billing state
  const { data: billing } = await supabase
    .from('creator_billing')
    .select('*')
    .eq('creator_id', creatorId)
    .single();

  if (!billing) {
    console.log(`No billing record for creator: ${creatorId}`);
    return;
  }

  // Credit the amount back - first reduce negative balance, then add to available
  let reduceNegative = 0;
  let addToAvailable = 0;

  if (billing.negative_balance_cents > 0) {
    reduceNegative = Math.min(billing.negative_balance_cents, disputeAmount);
    addToAvailable = disputeAmount - reduceNegative;
  } else {
    addToAvailable = disputeAmount;
  }

  const newNegative = billing.negative_balance_cents - reduceNegative;
  const newAvailable = billing.available_balance_cents + addToAvailable;

  // Update creator_billing
  await supabase
    .from('creator_billing')
    .update({
      available_balance_cents: newAvailable,
      negative_balance_cents: newNegative,
      updated_at: new Date().toISOString(),
    })
    .eq('creator_id', creatorId);

  // Create balance_transaction record
  await supabase
    .from('balance_transactions')
    .insert({
      creator_id: creatorId,
      type: 'chargeback_reversal',
      amount_cents: disputeAmount, // Positive because it's a credit
      pending_after_cents: billing.pending_balance_cents,
      available_after_cents: newAvailable,
      reserved_after_cents: billing.reserved_balance_cents,
      negative_after_cents: newNegative,
      reference_type: 'dispute',
      reference_id: disputeId,
      stripe_id: disputeId,
      description: 'Chargeback dispute won - funds returned',
      metadata: {
        reduced_negative: reduceNegative,
        added_to_available: addToAvailable,
      },
    });

  console.log(`Chargeback reversal for creator ${creatorId}: +${disputeAmount} cents (negative: -${reduceNegative}, available: +${addToAvailable})`);
}
