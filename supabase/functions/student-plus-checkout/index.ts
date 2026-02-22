// ============================================================================
// STUDENT PLUS CHECKOUT EDGE FUNCTION
// Creates a Stripe Checkout session for Student Plus subscription
// ============================================================================
//
// Endpoint: POST /student-plus-checkout
// Body: { successUrl: string, cancelUrl: string }
// Returns: { checkoutUrl: string, sessionId: string }
//
// Security:
// - Requires valid JWT authentication
// - STRIPE_SECRET_KEY is never exposed to client
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { getUserFromToken, createServiceClient } from '../_shared/supabase.ts';
import { getStripeClient, getStripeConfig } from '../_shared/stripe.ts';
import {
  jsonResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '../_shared/response.ts';

// Student Plus subscription configuration loaded at runtime based on STRIPE_SECRET_KEY mode
// Uses getStripeConfig() to automatically select test or live mode IDs

interface CheckoutRequest {
  successUrl: string;
  cancelUrl: string;
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
    const { successUrl, cancelUrl } = body;

    if (!successUrl || !cancelUrl) {
      return errorResponse('Missing successUrl or cancelUrl');
    }

    // Initialize Stripe and Supabase
    const stripe = getStripeClient();
    const supabase = createServiceClient();

    // Get or create student subscription record
    const { data: existingSub } = await supabase
      .from('student_subscriptions')
      .select('id, status, stripe_customer_id, stripe_subscription_id')
      .eq('user_id', user.userId)
      .single();

    // Check if user already has an active subscription
    if (existingSub?.status === 'active' || existingSub?.status === 'trialing') {
      return errorResponse('You already have an active Student Plus subscription');
    }

    let customerId = existingSub?.stripe_customer_id;

    // Get user profile for Stripe customer creation
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.userId)
      .single();

    if (!profile?.email) {
      return errorResponse('User profile or email not found');
    }

    // Create or retrieve Stripe customer
    if (!customerId) {
      // Search for existing Stripe customer by email
      const existingCustomers = await stripe.customers.list({
        email: profile.email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id;
      } else {
        // Create new Stripe customer
        const customer = await stripe.customers.create({
          email: profile.email,
          name: profile.full_name || undefined,
          metadata: {
            user_id: user.userId,
            platform: 'creator_club',
            subscription_type: 'student_plus',
          },
        });
        customerId = customer.id;
      }

      // Upsert student subscription record with customer ID
      await supabase
        .from('student_subscriptions')
        .upsert({
          user_id: user.userId,
          stripe_customer_id: customerId,
          status: 'incomplete',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });
    }

    // Get mode-aware Student Plus config (test or live)
    const studentPlusConfig = getStripeConfig().studentPlus;

    // Create Stripe Checkout session for subscription
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: studentPlusConfig.priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl.includes('{CHECKOUT_SESSION_ID}')
        ? successUrl
        : `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: {
          user_id: user.userId,
          subscription_type: 'student_plus',
        },
      },
      metadata: {
        type: 'student_plus_subscription',
        user_id: user.userId,
      },
      // Allow promotion codes for marketing
      allow_promotion_codes: true,
    });

    return jsonResponse({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Student Plus checkout error:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : 'Failed to create checkout session'
    );
  }
});
