// ============================================================================
// COMMUNITY PORTAL EDGE FUNCTION
// Creates a Stripe Customer Portal session for community subscription management
// ============================================================================
//
// Endpoint: POST /community-portal
// Body: { communityId: string, returnUrl: string }
// Returns: { portalUrl: string }
//
// Security:
// - Requires valid JWT authentication
// - User must have an existing membership with a Stripe customer for the community
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
  communityId: string;
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
    const { communityId, returnUrl } = body;

    if (!communityId) {
      return errorResponse('Missing communityId');
    }

    if (!returnUrl) {
      return errorResponse('Missing returnUrl');
    }

    // Initialize Stripe and Supabase
    const stripe = getStripeClient();
    const supabase = createServiceClient();

    // IMPORTANT: Look up the user's profile ID
    // Database FKs reference profiles.id, NOT auth.users.id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.userId)
      .single();

    if (profileError || !profile) {
      console.error('Profile lookup error:', profileError);
      return errorResponse('User profile not found', 404);
    }

    // Get the user's membership for this community
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('stripe_customer_id, stripe_subscription_id, payment_status')
      .eq('user_id', profile.id)
      .eq('community_id', communityId)
      .single();

    if (membershipError && membershipError.code !== 'PGRST116') {
      console.error('Database error:', membershipError);
      return serverErrorResponse('Failed to retrieve membership');
    }

    if (!membership) {
      return errorResponse(
        'No membership found for this community.',
        404
      );
    }

    if (!membership.stripe_customer_id) {
      return errorResponse(
        'No subscription found for this community. This may be a free community or payment was not completed.',
        404
      );
    }

    // Create Stripe Customer Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: membership.stripe_customer_id,
      return_url: returnUrl,
    });

    return jsonResponse({
      portalUrl: portalSession.url,
    });
  } catch (error) {
    console.error('Community portal error:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : 'Failed to create portal session'
    );
  }
});
