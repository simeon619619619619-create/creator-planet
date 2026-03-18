// ============================================================================
// REMOVE STUDENT EDGE FUNCTION
// Allows a creator to remove a student from their community
// Cancels any active Stripe subscription and deletes membership
// ============================================================================
//
// Endpoint: POST /remove-student
// Body: { communityId: string, studentProfileId: string }
// Returns: { success: true } or { error: string }
//
// Security:
// - Requires valid JWT authentication
// - Caller must be the community creator
// - STRIPE_SECRET_KEY used server-side only
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { getUserFromToken, createServiceClient } from '../_shared/supabase.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import {
  jsonResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '../_shared/response.ts';

interface RemoveStudentRequest {
  communityId: string;
  studentProfileId: string;
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
    const body: RemoveStudentRequest = await req.json();
    const { communityId, studentProfileId } = body;

    if (!communityId || !studentProfileId) {
      return errorResponse('Missing communityId or studentProfileId');
    }

    // Initialize clients
    const supabase = createServiceClient();

    // Look up caller's profile ID
    const { data: callerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.userId)
      .single();

    if (profileError || !callerProfile) {
      return errorResponse('Caller profile not found', 404);
    }

    // Verify the caller is the community creator
    const { data: community, error: communityError } = await supabase
      .from('communities')
      .select('id, creator_id')
      .eq('id', communityId)
      .single();

    if (communityError || !community) {
      return errorResponse('Community not found', 404);
    }

    if (community.creator_id !== callerProfile.id) {
      return forbiddenResponse('Only the community creator can remove students');
    }

    // Prevent creator from removing themselves
    if (studentProfileId === callerProfile.id) {
      return errorResponse('Cannot remove yourself from your own community');
    }

    // Get the student's membership (check it exists and get subscription info)
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('id, user_id, stripe_subscription_id, payment_status')
      .eq('user_id', studentProfileId)
      .eq('community_id', communityId)
      .single();

    if (membershipError || !membership) {
      return errorResponse('Student membership not found', 404);
    }

    // Cancel Stripe subscription if active
    if (membership.stripe_subscription_id && membership.payment_status === 'paid') {
      try {
        const stripe = getStripeClient();
        await stripe.subscriptions.cancel(membership.stripe_subscription_id);
        console.log(`Canceled subscription ${membership.stripe_subscription_id} for student ${studentProfileId}`);
      } catch (stripeError) {
        console.error('Stripe subscription cancellation error:', stripeError);
        // Continue with removal even if Stripe cancel fails
        // (subscription may already be canceled or invalid)
      }
    }

    // Delete the membership
    const { error: deleteError } = await supabase
      .from('memberships')
      .delete()
      .eq('user_id', studentProfileId)
      .eq('community_id', communityId);

    if (deleteError) {
      console.error('Error deleting membership:', deleteError);
      return serverErrorResponse('Failed to remove student membership');
    }

    // Clean up related data

    // Remove from community groups
    const { data: communityGroups } = await supabase
      .from('community_groups')
      .select('id')
      .eq('community_id', communityId);

    if (communityGroups && communityGroups.length > 0) {
      const groupIds = communityGroups.map((g: { id: string }) => g.id);
      await supabase
        .from('community_group_members')
        .delete()
        .eq('member_id', studentProfileId)
        .in('group_id', groupIds);
    }

    // Remove event attendee records for this community's events
    const { data: communityEvents } = await supabase
      .from('events')
      .select('id')
      .eq('community_id', communityId);

    if (communityEvents && communityEvents.length > 0) {
      const eventIds = communityEvents.map((e: { id: string }) => e.id);
      await supabase
        .from('event_attendees')
        .delete()
        .eq('user_id', studentProfileId)
        .in('event_id', eventIds);
    }

    console.log(`Successfully removed student ${studentProfileId} from community ${communityId}`);

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Remove student error:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : 'Failed to remove student'
    );
  }
});
