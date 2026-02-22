// ============================================================================
// STUDENT PLUS PORTAL EDGE FUNCTION
// Creates a Stripe Customer Portal session for subscription management
// ============================================================================
//
// Endpoint: POST /student-plus-portal
// Body: { returnUrl: string }
// Returns: { portalUrl: string }
//
// Security:
// - Requires valid JWT authentication
// - User must have an existing Student Plus subscription with a Stripe customer
// - STRIPE_SECRET_KEY is never exposed to client
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { getUserFromToken, createServiceClient } from '../_shared/supabase.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import {
  jsonResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '../_shared/response.ts';

interface PortalRequest {
  returnUrl: string;
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
    const body: PortalRequest = await req.json();
    const { returnUrl } = body;

    if (!returnUrl) {
      return errorResponse('Missing returnUrl');
    }

    // Initialize Stripe and Supabase
    const stripe = getStripeClient();
    const supabase = createServiceClient();

    // Get the user's subscription record
    const { data: subscription, error: subError } = await supabase
      .from('student_subscriptions')
      .select('stripe_customer_id, status')
      .eq('user_id', user.userId)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      console.error('Database error:', subError);
      return serverErrorResponse('Failed to retrieve subscription');
    }

    if (!subscription?.stripe_customer_id) {
      return errorResponse(
        'No subscription found. Please subscribe to Student Plus first.',
        404
      );
    }

    // Create Stripe Customer Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: returnUrl,
    });

    return jsonResponse({
      portalUrl: portalSession.url,
    });
  } catch (error) {
    console.error('Student Plus portal error:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : 'Failed to create portal session'
    );
  }
});
