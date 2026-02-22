// ============================================================================
// TBI CANCEL EDGE FUNCTION
// Cancels pending TBI Bank applications
// ============================================================================
//
// Endpoints:
// POST /tbi-cancel
//   - Requires authentication
//   - Body: { applicationId: string }
//   - Cancels a pending application
//
// Security:
// - Only application owner (buyer) can cancel
// - Only pending/processing applications can be cancelled
//
// Note: TBI has no cancel endpoint - cancellation is local only
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { getUserFromToken, createServiceClient } from '../_shared/supabase.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, serverErrorResponse } from '../_shared/response.ts';
import { cancelApplication } from '../_shared/tbi.ts';

interface CancelRequest {
  applicationId: string;
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
    const body: CancelRequest = await req.json();
    const { applicationId } = body;

    if (!applicationId) {
      return errorResponse('applicationId is required');
    }

    // Initialize Supabase client
    const supabase = createServiceClient();

    // Get user's profile ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.userId)
      .single();

    if (!profile) {
      return errorResponse('User profile not found');
    }

    // Get application
    const { data: application, error: appError } = await supabase
      .from('tbi_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (appError || !application) {
      return errorResponse('Application not found', 404);
    }

    // Verify ownership - only the buyer can cancel
    if (application.buyer_id !== profile.id) {
      return errorResponse('You can only cancel your own applications', 403);
    }

    // Check if cancellable
    const cancellableStates = ['pending', 'processing'];
    if (!cancellableStates.includes(application.status)) {
      return errorResponse(`Cannot cancel application with status: ${application.status}`);
    }

    // Call cancelApplication (local-only no-op since TBI has no cancel endpoint)
    await cancelApplication();

    // Update application status to cancelled
    const { error: updateError } = await supabase
      .from('tbi_applications')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    if (updateError) {
      console.error('Error updating application status:', updateError);
      return serverErrorResponse('Failed to cancel application');
    }

    // Delete pending membership/enrollment
    if (application.membership_id) {
      await supabase
        .from('memberships')
        .delete()
        .eq('id', application.membership_id)
        .eq('payment_status', 'pending');
    }

    if (application.enrollment_id) {
      await supabase
        .from('enrollments')
        .delete()
        .eq('id', application.enrollment_id)
        .eq('status', 'pending');
    }

    return jsonResponse({
      success: true,
      message: 'Application cancelled successfully',
      applicationId,
    });
  } catch (error) {
    console.error('TBI Cancel error:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : 'Failed to cancel application'
    );
  }
});
